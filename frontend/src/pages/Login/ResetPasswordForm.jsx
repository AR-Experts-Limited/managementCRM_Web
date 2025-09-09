import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { IoEye, IoEyeOff } from "react-icons/io5";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const ResetPasswordForm = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [showPass, setShowPass] = useState({ password: false, confirmPassword: false });
    const { token } = useParams();

    const validatePassword = (password) => {
        const hasUpperCase = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        return hasUpperCase && hasNumber && hasSpecialChar;
    };

    useEffect(() => {
        if (confirmPassword) {
            setError(prev => ({
                ...prev,
                confirmPassword: confirmPassword !== password ? "Passwords do not match." : false
            }));
        }
    }, [password, confirmPassword]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        let newErrors = {};

        if (!password) {
            newErrors.password = 'Password cannot be empty.';
        }

        // if (!validatePassword(password)) {
        //     newErrors.password = 'Password must contain at least one capital letter, one number, and one special character.';
        // }

        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password.';
        } else if (confirmPassword !== password) {
            newErrors.confirmPassword = 'Passwords do not match.';
        }

        if (Object.keys(newErrors).length > 0) {
            setError(newErrors);
            return;
        }

        try {
            await axios.post(`${API_BASE_URL}/api/applicationAuth/reset-password/${token}`, { password });
            setSubmitted(true);
        } catch (error) {
            setError(prev => ({
                ...prev,
                server: error.response?.data?.message || 'Failed to reset password.'
            }));
        }
    };

    return (
        <div className='dark:bg-dark-1 h-screen w-screen relative flex justify-center items-center overflow-hidden '>
            <div className='z-0 dark:hidden absolute -top-25 -right-30 bg-[#006173]/30 h-160 w-160 blur-[90rem] rounded-full'></div>
            <div className='z-0 dark:hidden absolute -bottom-55 -left-55 bg-[#89CA38]/30 h-180 w-180 blur-[90rem] rounded-full'></div>

            <div className="z-10 py-2 md:py-5 px-5 min-h-130 min-w-140 md:px-14 flex flex-col items-center bg-gradient-to-br from-[#047ba4]/80 to-[#498b15fc]/80 shadow-[8px_5px_30px_8px_rgba(0,0,0,0.25)] border-2 border-stone-600/30 rounded-xl backdrop-blur-sm">
                <img className="h-45 w-45 mb-2" src="/Asset_3.png" alt="Logo" />

                {!submitted ? (
                    <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-6">
                        <h2 className="text-2xl w-full text-center text-white font-bold text-gray-800 mb-2">Reset Your Password</h2>
                        <div className='relative'>
                            <input
                                type={showPass.password ? 'text' : 'password'}
                                placeholder="New Password"
                                required
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError(prev => ({ ...prev, password: false }));
                                }}
                                className={`w-full bg-white/80 rounded-lg border border-neutral-300 p-4 outline-none focus:border-cyan-800 focus:ring-2 focus:ring-cyan-800 ${error.password ? 'animate-pulse border-2 border-red-300' : ''}`}
                            />
                            <div
                                className='cursor-pointer absolute text-stone-400 bottom-[1.2rem] right-5'
                                onClick={() => setShowPass(prev => ({ ...prev, password: !prev.password }))}
                            >
                                {showPass.password ? <IoEyeOff size={20} /> : <IoEye size={20} />}
                            </div>
                        </div>
                        {error.password && (
                            <div className="text-sm text-red-400">*{error.password}</div>
                        )}
                        <div className='relative'>
                            <input
                                type={showPass.confirmPassword ? 'text' : 'password'}
                                placeholder="Confirm Password"
                                required
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setError(prev => ({ ...prev, confirmPassword: false }));
                                }}
                                className={`w-full bg-white/80 rounded-lg border border-neutral-300 p-4 outline-none focus:border-cyan-800 focus:ring-2 focus:ring-cyan-800 ${error.confirmPassword ? 'animate-pulse border-2 border-red-300' : ''}`}
                            />
                            <div
                                className='cursor-pointer absolute text-stone-400 bottom-[1.2rem] right-5'
                                onClick={() => setShowPass(prev => ({ ...prev, confirmPassword: !prev.confirmPassword }))}
                            >
                                {showPass.confirmPassword ? <IoEyeOff size={20} /> : <IoEye size={20} />}
                            </div>
                        </div>
                        {error.confirmPassword && (
                            <div className="text-sm text-red-400">*{error.confirmPassword}</div>
                        )}
                        <button
                            type="submit"
                            className="flex justify-center items-center text-white rounded-lg w-full h-10 bg-[#006173]/80 hover:bg-[#006173]/50 shadow-md transition-all duration-200"
                        >
                            Reset Password
                        </button>
                        {error.server && (
                            <div className="w-full text-sm p-2 rounded-md bg-red-200/60 border border-red-400 text-red-400 flex justify-center items-center gap-3 mt-3">
                                <div className="text-xs font-bold p-2 flex justify-center items-center bg-red-400 h-2 w-2 text-white rounded-full">!</div>
                                {error.server}
                            </div>
                        )}
                    </form>
                ) : (
                    <p className="text-base text-white text-center">
                        Your password has been reset. Continue where you left off.
                    </p>
                )}
            </div>
        </div>
    );
};

export default ResetPasswordForm;