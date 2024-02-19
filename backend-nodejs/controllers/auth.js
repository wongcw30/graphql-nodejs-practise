const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const User = require('../models/user');

exports.signup = async (req, res, next) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			const error = new Error('Validation failed!');
			error.statusCode = 422;
			error.data = errors.array();
			throw error;
		}

		const email = req.body.email;
		const name = req.body.name;
		const password = req.body.password;
		const hashedPw = await bcrypt.hash(password, 12);
		const user = new User({
			email: email,
			name: name,
			password: hashedPw
		});
		const result = await user.save();
		res.status(201).json({ message: 'User created!', userId: result._id });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.login = async (req, res, next) => {
	try {
		const email = req.body.email;
		const password = req.body.password;
		const user = await User.findOne({ email: email });
		if (!user) {
			const error = new Error('User cannot be found or password doesnt match');
			error.statusCode = 401;
			throw error;
		}
		loadedUser = user;
		const isEqual = await bcrypt.compare(password, user.password);
		if (!isEqual) {
			const error = new Error('User cannot be found or password doesnt match');
			error.statusCode = 401;
			throw error;
		}
		const token = jwt.sign(
			{
				email: loadedUser.email,
				userId: loadedUser._id.toString()
			},
			'398c2088-3d6c-465b-8048-ade8b5def0a2',
			{ expiresIn: '1h' }
		);
		res.status(200).json({ token: token, userId: loadedUser._id.toString() });
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.getStatus = async (req, res, next) => {
	try {
		const user = await User.findById(req.userId);
		if (!user) {
			const error = new Error('Cant find the user');
			error.statusCode = 404;
			throw error;
		}
		res.status(200).json({
			message: 'User status fetched successfully',
			status: user.status
		});
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};

exports.updateStatus = async (req, res, next) => {
	try {
		let updatedStatus = req.body.status;
		const user = await User.findById(req.userId);
		if (!user) {
			const error = new Error('Cant find the user');
			error.statusCode = 404;
			throw error;
		}
		user.status = updatedStatus;
		await user.save();
		res.status(200).json({
			message: 'User status updated successfully'
		});
	} catch (err) {
		if (!err.statusCode) {
			err.statusCode = 500;
		}
		next(err);
	}
};
