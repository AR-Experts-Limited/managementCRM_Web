const express = require('express');
const userAuth = require('../middleware/userAuth')
const router = express.Router();
const { getUsers, getUserByEmail, loginUser, logoutUser, isAuth, verifyOtp, refreshToken, signUp, deleteUser, deleteByUserId, updateUser, updateByUserId, updatePassword } = require('../controllers/authController');

router.get('/', getUsers);
router.get('/getUserByEmail/:email', getUserByEmail);
router.post('/is-auth', userAuth, isAuth);
router.post('/logout', logoutUser)
router.post('/login', loginUser);
router.post('/verify-otp', verifyOtp);
router.post('/refresh-token', refreshToken);
router.post('/signup', signUp);
router.delete('/:id',deleteUser);
router.delete('/deleteByUserID/:user_ID', deleteByUserId);
router.put('/by-userid', updateByUserId);
router.put('/:id', updateUser);
router.post('/updatepassword', updatePassword);

module.exports = router;