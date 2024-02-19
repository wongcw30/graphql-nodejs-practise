const express = require('express');
const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');

const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

exports.getPosts = async (req, res, next) => {
	const currentPage = req.query.page || 1;
	const perPage = 2;

	try {
		const totalItems = await Post.find().countDocuments();
		const posts = await Post.find()
			.populate('creator')
			.sort({ createdAt: 'desc' })
			.skip((currentPage - 1) * perPage)
			.limit(perPage);

		res.status(200).json({
			message: 'Post fetched successfully',
			posts: posts,
			totalItems: totalItems
		});
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.createPosts = async (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		const error = new Error('Validation failed!');
		error.statusCode = 422;
		throw error;
	}
	if (!req.file) {
		const error = new Error('No image provided!');
		error.statusCode = 422;
		throw error;
	}

	const imageUrl = req.file.path;
	const title = req.body.title;
	const content = req.body.content;

	const post = new Post({
		title: title,
		content: content,
		creator: req.userId,
		imageUrl: imageUrl
	});

	try {
		const updatedPost = await post.save();
		const user = await User.findById(req.userId);
		user.posts.push(post);
		await user.save();

		io.getIO().emit('posts', {
			action: 'create',
			post: { ...post._doc, creator: { _id: req.userId, name: user.name } }
		});

		res.status(201).json({
			message: 'Post created successfully',
			post: post,
			creator: { id: user._id, name: user.name }
		});
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.getPost = async (req, res, next) => {
	const postId = req.params.postId;
	console.log(postId);
	try {
		const post = await Post.findById(postId);
		res.status(200).json({
			message: 'Post fetched successfully',
			post: post
		});
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.updatePost = async (req, res, next) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error('Validation failed!');
			error.statusCode = 422;
			throw error;
		}
		const postId = req.params.postId;
		const title = req.body.title;
		const content = req.body.content;
		let imageUrl = req.body.image;
		if (req.file) {
			imageUrl = req.file.path;
		}
		if (!imageUrl) {
			const error = new Error('No file picked!');
			error.statusCode = 422;
			throw error;
		}

		const post = await Post.findById(postId).populate('creator');
		if (!post) {
			const error = new Error('Cant find the post');
			error.statusCode = 404;
			throw error;
		}

		if (post.creator._id.toString() !== req.userId) {
			const error = new Error('Not authorised');
			error.statusCode = 403;
			throw error;
		}

		if (imageUrl !== post.imageUrl) {
			clearImage(post.imageUrl);
		}

		post.title = title;
		post.imageUrl = imageUrl;
		post.content = content;
		const result = await post.save();

		io.getIO().emit('posts', {
			action: 'update',
			post: result
		});

		res.status(200).json({
			message: 'Post updated successfully',
			post: post
		});
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.deletePost = async (req, res, next) => {
	try {
		const postId = req.params.postId;
		const post = await Post.findById(postId);

		if (!post) {
			const error = new Error('Cant find the post');
			error.statusCode = 404;
			throw error;
		}

		if (post.creator.toString() !== req.userId) {
			const error = new Error('Not authorised');
			error.statusCode = 403;
			throw error;
		}

		clearImage(post.imageUrl);
		await Post.findByIdAndDelete(postId);
		const user = await User.findById(req.userId);
		user.posts.pull(postId);
		user.save();

		io.getIO().emit('posts', { action: 'delete', post: postId });

		res.status(200).json({
			message: 'Post deleted successfully'
		});
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
	/*
	Post.findById(postId)
		.then((post) => {
			if (!post) {
				const error = new Error('Cant find the post');
				error.statusCode = 404;
				throw error;
			}

			if (post.creator.toString() !== req.userId) {
				const error = new Error('Not authorised');
				error.statusCode = 403;
				throw error;
			}

			clearImage(post.imageUrl);
			return Post.findByIdAndDelete(postId);
		})
		.then((result) => {
			return User.findById(req.userId);
		})
		.then((user) => {
			user.posts.pull(postId);
			return user.save();
		})
		.then((result) => {
			res.status(200).json({
				message: 'Post deleted successfully',
				post: result
			});
		})
		.catch((err) => {
			if (!err.statusCode) {
				err.statusCode = 500;
			}
			next(err);
		});

	*/
};

const clearImage = (filePath) => {
	filePath = path.join(__dirname, '..', filePath);
	fs.unlink(filePath, (err) => console.log(err));
};
