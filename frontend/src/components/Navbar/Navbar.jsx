import React, { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../features/auth/authSlice';
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";

import { IoChevronDown } from "react-icons/io5";
import { PiBell } from "react-icons/pi";
import { IoIosNotificationsOutline } from "react-icons/io";
import { TbLayoutDashboard } from "react-icons/tb";
import { IoFileTrayFullOutline } from "react-icons/io5";
import { PiClockClockwiseLight } from "react-icons/pi";
import { CiCircleMinus } from "react-icons/ci";
import { BsCalendarDate } from "react-icons/bs";
import { FiSettings, FiLock, FiLogOut, FiUsers } from 'react-icons/fi';
import { HiOutlineListBullet } from "react-icons/hi2";
import { CiCirclePlus } from "react-icons/ci";
import { MdAccessTime } from "react-icons/md";
import { BiMoneyWithdraw } from "react-icons/bi";
import { BiPrinter } from "react-icons/bi";
import { BiLineChart } from "react-icons/bi";
import { IoChevronForward } from "react-icons/io5";
import { BiStation } from "react-icons/bi";
import { FaCalendarDays } from "react-icons/fa6";
import NotificationPanel from "../NotificationPanel/NotificationPanel";
import axios from 'axios'
const API_BASE_URL = import.meta.env.VITE_API_URL;

const menuItems = [
    { path: "/dashboard", name: "Dashboard", icon: <TbLayoutDashboard size={20} /> },
    { path: "/manage-drivers", name: "Manage Drivers", icon: <FiUsers size={20} /> },
    { path: "/rate-card", name: "Rate Cards", icon: <IoFileTrayFullOutline size={20} /> },
    { path: "/notifications", name: "Notifications", icon: <IoIosNotificationsOutline size={20} /> },
    { path: "/planner", name: "Schedule Planner", icon: <BsCalendarDate size={20} /> },
    { path: "/live-operations", name: "Live Operations", icon: <BiStation size={20} /> },
    { path: "/rota", name: "Rota", icon: <PiClockClockwiseLight size={20} /> },
    { path: "/working-hours", name: "Working Hours", icon: <MdAccessTime size={20} /> },
    { path: "/installments", name: "Installments", icon: <BiMoneyWithdraw size={20} /> },
    { path: "/deductions", name: "Deductions", icon: <CiCircleMinus size={20} /> },
    { path: "/incentives", name: "Incentives", icon: <CiCirclePlus size={20} /> },
    { path: "/manage-summary", name: "Manage Summary", icon: <HiOutlineListBullet size={20} /> },
    { path: "/manage-payments", name: "Manage Payments", icon: <span className='manage-payments-symbol'>£</span> },
    { path: "/print-invoices", name: "Print Invoices", icon: <BiPrinter size={20} /> },
    { path: "/spending-insights", name: "Spending Insights", icon: <BiLineChart size={20} /> },
];

const Navbar = ({ sidebarIsOpen, setSidebarIsOpen }) => {
    const [userOptionsOpen, setUserOptionsOpen] = useState(false);
    const [notification, setNotification] = useState([]);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const { events, connected } = useSelector((state) => state.sse);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { userDetails } = useSelector((state) => state.auth);
    const calendarRef = useRef(null);
    const flatpickrInstance = useRef(null);

    const fetchNotifications = async () => {
        const url = userDetails?.site
            ? `${API_BASE_URL}/api/notifications/${userDetails.site}`
            : `${API_BASE_URL}/api/notifications/`;

        const notifications = await axios.get(url);
        const filteredNotifications = notifications.data.filter(item => {
            const notification = item.notification;
            return !notification.hasOwnProperty('excludeRoles') ||
                (Array.isArray(notification.excludeRoles)
                    ? !notification.excludeRoles.includes(userDetails.role)
                    : notification.excludeRoles !== userDetails.role);
        });
        setNotification(filteredNotifications);
    };

    useEffect(() => {
        fetchNotifications();
        if (events && (events.type === "notificationUpdated" || events.type === "approvalStatusUpdated")) {
            console.log("notification added! Refetching...");
            fetchNotifications();
        }
    }, [events]);

    useEffect(() => {
        if (calendarOpen && calendarRef.current && !flatpickrInstance.current) {
            flatpickrInstance.current = flatpickr(calendarRef.current, {
                inline: true,
                disableMobile: true,
                weekNumbers: true,
                onReady: () => {
                    const days = document.querySelectorAll(".flatpickr-day");
                    days.forEach((day) => (day.style.pointerEvents = "none"));
                }
            });
        }

        // Cleanup on unmount
        return () => {
            if (flatpickrInstance.current) {
                flatpickrInstance.current.destroy();
                flatpickrInstance.current = null;
            }
        };
    }, [calendarOpen]);


    return (
        <div className="navbar z-500 p-2 md:p-5 flex items-center justify-between h-18 bg-primary-600/80 w-screen border-b border-stone-400/40 dark:bg-dark dark:text-white">
            
            <div className="justify-self-start flex flex-row items-center gap-0">
                <img className="h-20 w-20" src="/bizalign.png" />
                <h1 className="uppercase text-white font-[600] tracking-[0.12em] text-lg leading-[1]">BIZALIGN HR</h1>
            </div>

            <div className="relative flex-1 flex gap-1 md:gap-3 items-center justify-end">

                <button className='relative text-xs md:text-lg h-8 w-8 md:h-11 md:w-11 flex cursor-pointer justify-center items-center text-black rounded-full hover:text-primary-500 dark:text-white dark:bg-dark-3 dark:border-dark-4' onClick={() => setCalendarOpen(prev => !prev)}>
                    <i className=" flex items-center fi fi-rr-calendar hover:text-primary-800 text-[1.25rem] text-white"></i>
                    <div onClick={(e) => e.stopPropagation()} className={`absolute top-12 right-2 rounded-lg border border-neutral-300 shadow-md transition-all duration-300 origin-top-right transform ${calendarOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} >
                        <div ref={calendarRef}></div>
                    </div>
                </button>


                <button
                    onClick={() => setNotificationOpen(prev => !prev)}
                    className="relative text-xs md:text-lg h-8 w-8 md:h-11 md:w-11 flex cursor-pointer justify-center items-center text-black rounded-full hover:text-primary-500 dark:text-white dark:bg-dark-3 dark:border-dark-4"
                >
                    <i className="flex items-center fi fi-rr-bell hover:text-primary-800 text-[1.25rem] text-white"></i>
                    <div className={`absolute top-12 bg-white/10 backdrop-blur-md right-2 rounded-lg border border-neutral-300 shadow-md transition-all duration-300 origin-top-right transform ${notificationOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                        <NotificationPanel notifications={notification} setNotifications={setNotification} />
                    </div>
                    {notification.length > 0 && <div className={`flex items-center justify-center absolute -top-1 -right-1 bg-red-600/85 h-5  rounded-full text-white ${notification.length < 100 ? 'text-[0.7rem] w-5' : 'text-[0.6rem] p-1'}  font-semibold shadow-xl`}>
                        {notification.length < 100 ? notification.length : '99+'}
                    </div>}
                </button>
                <div className="text-xs md:text-lg ml-1 h-8 w-8 md:h-11 md:w-11 flex justify-center items-center rounded-full bg-black text-white">
                    {userDetails?.userName.split(' ')[0].slice(0, 1).toUpperCase() + userDetails?.userName.split(' ')[1].slice(0, 1).toUpperCase()}
                </div>

                <div className="flex flex-col md:gap-1 group">
                    <p className="text-xs hidden md:block text-white">{userDetails?.userName}</p>
                    <div className="flex gap-1 items-center justify-between">
                        <span className="hidden md:block text-xs bg-neutral-200 text-black rounded-md px-1.5 py-0.5">{userDetails?.role}</span>
                        <button
                            onClick={() => setUserOptionsOpen(prev => !prev)}
                            className={`rounded-full p-1 hover:bg-neutral-200 hover:text-black text-white`}
                        >
                            <IoChevronDown
                                className={`transform transition duration-500 ${userOptionsOpen ? 'rotate-180 ' : ''}`}
                                size={15}
                            />
                        </button>
                    </div>

                    <div
                        id="userOptions"
                        className={`flex flex-col absolute top-9 md:top-12 right-0 bg-white/80 dark:bg-dark-5/80 dark:border-dark-6 shadow-lg backdrop-blur-sm rounded-lg border-2 border-neutral-200 transition-all duration-300 origin-top-right transform ${userOptionsOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                    >
                        <div className="flex flex-col p-1 md:p-2">
                            <button
                                onClick={() => navigate('/update-password')}
                                className={`hover:bg-zinc-300/70 rounded-md p-2 text-xs md:text-sm w-full flex items-center gap-2`}
                            >
                                <FiLock size={15} /> Update Password
                            </button>
                            <button
                                onClick={() => navigate('/settings')}
                                className={`hover:bg-zinc-300/70 rounded-md p-2 text-xs md:text-sm w-full flex items-center gap-2`}
                            >
                                <FiSettings size={15} /> Account Settings
                            </button>
                        </div>
                        <div className="p-1 md:p-2 border-t border-neutral-300">
                            <button
                                onClick={() => {
                                    dispatch(logout());
                                    navigate('/login');
                                }}
                                className={`hover:text-red-500 hover:bg-zinc-300/70 rounded-md p-2 text-xs md:text-sm w-full flex items-center gap-2`}
                            >
                                <FiLogOut size={15} /> Log out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Navbar;