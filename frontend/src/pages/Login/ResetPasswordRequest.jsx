import React, { useState } from 'react';
import axios from 'axios';
import emailjs from '@emailjs/browser';
import { Navigate, useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const ResetPasswordRequest = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const navigate = useNavigate()

    const sendResetEmail = (email, resetLink) => {
        emailjs.send('service_d4b275e', 'template_owcyed3', {
            email: email,
            reset_link: resetLink,
        }, 'qs5aue-6VlvSQuBlX')
            .then((result) => console.log('Email sent:', result))
            .catch((error) => console.error('Email error:', error));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        try {
            const response = await axios.post(`${API_BASE_URL}/api/applicationAuth/forgot-password`, { email });
            const resetLink = response.data.resetLink;

            sendResetEmail(email, resetLink);
            setMessage('Please check your email for the password reset link.');
            setSubmitted(true);
        } catch (error) {
            setError(error.response?.data?.message || 'Something went wrong. Please try again.');
        }
    };


    return (
        <div className='dark:bg-dark-1 h-screen w-screen relative flex justify-center items-center overflow-hidden '>

            <div className='z-0 dark:hidden absolute -top-25 -right-30 bg-[#006173]/30 h-160 w-160 blur-[90rem] rounded-full'></div>
            <div className='z-0 dark:hidden absolute -bottom-55 -left-55 bg-[#89CA38]/30 h-180 w-180 blur-[90rem] rounded-full'></div>

            <div className="z-10 py-2 md:py-5 px-5 min-h-130 min-w-140 md:px-14 flex flex-col items-center bg-gradient-to-br from-[#047ba4]/80 to-[#498b15fc]/80 shadow-[8px_5px_30px_8px_rgba(0,0,0,0.25)] border-2 border-stone-600/30 rounded-xl backdrop-blur-sm">
                <img className="h-45 w-45 mb-6" src="/Asset_3.png" alt="Logo" />

                <h2 className="text-2xl text-white font-bold text-gray-800 mb-6">Forgot Password?</h2>
                {!submitted ? (
                    <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-6">
                        <input
                            type="email"
                            placeholder="Enter your registered email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/80 rounded-lg border border-neutral-300 p-4 outline-none focus:border-cyan-800 focus:ring-2 focus:ring-cyan-800"
                        />
                        <button
                            type="submit"
                            className="flex justify-center items-center text-white rounded-lg w-full h-10 bg-[#006173]/80 hover:bg-[#006173]/50 shadow-md transition-all duration-200"
                        >
                            Send Reset Link
                        </button>
                    </form>
                ) : (
                    <p className="text-base text-white text-center">{message}</p>
                )}
                <button onClick={() => navigate('/login')} className='text-white bg-amber-600 rounded-md px-2 py-1 mt-8'>Back to Login</button>

                {error && (
                    <div className="w-full text-sm p-2 rounded-md bg-red-200/60 border border-red-400 text-red-400 flex justify-center items-center gap-3 mt-3">
                        <div className="text-xs font-bold p-2 flex justify-center items-center bg-red-400 h-2 w-2 text-white rounded-full">!</div>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResetPasswordRequest;