import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { BiXCircle } from "react-icons/bi";
import { SlActionRedo } from "react-icons/sl";
import axios from 'axios'
import { useSelector, useDispatch } from 'react-redux';
const API_BASE_URL = import.meta.env.VITE_API_URL;

const NotificationPanel = ({ notifications, setNotifications, setNotifyOpen }) => {
    const [exitingCard, setExitingCard] = useState(null);
    const { userDetails: currentUser } = useSelector((state) => state.auth);

    // const currentUser = JSON.parse(localStorage.getItem('currentUser'))

    const fetchNotifications = async () => {
        const notifications = await axios.get(`${API_BASE_URL}/api/notifications`);
        const filteredNotifications = notifications.data.filter(item => {
            const notification = item.notification;
            if (notification.hasOwnProperty('excludeRoles')) {
                return notification.excludeRoles !== currentUser.role;
            }
            return true;
        });
        setNotifications(filteredNotifications);
        console.log("Notifications = ", filteredNotifications);
    }

    const handleClearNotification = async (e, id) => {
        e.stopPropagation()
        await axios.delete(`${API_BASE_URL}/api/notifications/${id}`)
        setExitingCard(id);
        setTimeout(() => {
            fetchNotifications()
            setExitingCard(null);
        }, 500);
    }

    const handleClearAllNotification = async (e) => {
        e.stopPropagation()
        await axios.delete(`${API_BASE_URL}/api/notifications/nf/clearall`, {
            data: {
                nfId: notifications.map((nf) => nf._id)
            }
        })
        notifications.map((nf) => {
            setExitingCard(nf._id);
            setTimeout(() => {
                setExitingCard(null);
            }, 500);
        })
    }

    const approveDriverDelete = async (notifID, driverID) => {
        const updatedDriver = { delReqStatus: "Approved" }
        const response = await axios.put(`${API_BASE_URL}/api/drivers/${driverID}`, updatedDriver);
        await axios.delete(`${API_BASE_URL}/api/notifications/${notifID}`)
        setExitingCard(notifID);
        setTimeout(() => {
            fetchNotifications()
            setExitingCard(null);
        }, 500);
    }

    const denyDriverDelete = async (notifID, driverID) => {
        const updatedDriver = { delReqStatus: "" }
        const response = await axios.put(`${API_BASE_URL}/api/drivers/${driverID}`, updatedDriver);
        await axios.delete(`${API_BASE_URL}/api/notifications/${notifID}`)
        setExitingCard(notifID);
        setTimeout(() => {
            fetchNotifications()
            setExitingCard(null);
        }, 500);
    }

    const approveOSMDelete = async (notifID, userID) => {
        const updatedOSM = { delReqStatus: "Approved" }
        const response = await axios.put(`${API_BASE_URL}/api/auth/${userID}`, updatedOSM);
        await axios.delete(`${API_BASE_URL}/api/notifications/${notifID}`)
        setExitingCard(notifID);
        setTimeout(() => {
            fetchNotifications()
            setExitingCard(null);
        }, 500);
    }

    const denyOSMDelete = async (notifID, userID) => {
        const updatedOSM = { delReqStatus: "" }
        const response = await axios.put(`${API_BASE_URL}/api/auth/${userID}`, updatedOSM);
        await axios.delete(`${API_BASE_URL}/api/notifications/${notifID}`)
        setExitingCard(notifID);
        setTimeout(() => {
            fetchNotifications()
            setExitingCard(null);
        }, 500);
    }

    return (
        <div className="rounded-lg p-2.5 text-base  w-80  z-10 transition-all duration-400 text-black">
            <div className="flex gap-2 justify-between mx-2 mb-4">
                <div className='flex gap-2 items-center'>
                    <h3 className="text-center text-lg font-semibold">Notifications</h3>
                    {notifications.length > 0 && <div className={`flex items-center justify-center bg-primary-400/70  h-5 w-8 rounded-full text-white text-xs `}>
                        {notifications.length}
                    </div>}
                </div>
                {(notifications?.length !== 0) &&
                    <button
                        onClick={handleClearAllNotification}
                        className="text-sm rounded-lg bg-black/40 border border-black/10 text-white px-2 py-1 hover:bg-black/60 transition-colors whitespace-nowrap"
                    >
                        Clear All
                    </button>
                }
            </div>
            <div className='flex flex-col gap-3 max-h-100 overflow-auto'>
                {(notifications?.length === 0) ? (
                    <div className="text-sm whitespace-nowrap font-light text-center">No new Notification</div>
                ) : null}
                {notifications?.map((nf) => {
                    const renderNotificationContent = () => {
                        switch (nf.notification?.changed) {
                            case "drivers":
                                return (
                                    <>
                                        <p className="font-bold">Personnels modified</p>
                                        <p className="text-sm my-1">{nf.notification.message}</p>
                                        <div className='flex gap-3 justify-center'>
                                            <button className="h-8 w-8 flex items-center justify-center bg-transparent border border-black/20 rounded-lg p-2 hover:bg-gray-300/40">
                                                <NavLink to='/manage-personnels' state={nf.notification?.driver}>
                                                    <SlActionRedo />
                                                </NavLink>
                                            </button>
                                            <button
                                                onClick={(e) => handleClearNotification(e, nf._id)}
                                                className="h-8 w-8 flex items-center justify-center bg-transparent border border-black/20 rounded-lg p-2 hover:bg-gray-300/40 text-red-500"
                                            >
                                                <BiXCircle size={17} />
                                            </button>
                                        </div>
                                        <div className="flex justify-end mr-2 mb-2">
                                            <i className="text-xs font-light">
                                                {formatDistanceToNow(new Date(nf.createdAt), { addSuffix: true })}
                                            </i>
                                        </div>
                                    </>
                                );
                            case "driverDoc":
                                return (
                                    <>
                                        <p className="font-bold">Personnel Document updated</p>
                                        <p className="text-sm my-1">{nf.notification.message}</p>
                                        <div className='flex gap-3 justify-center'>

                                            <button className="h-8 w-8 flex items-center justify-center bg-transparent border border-black/20 rounded-lg p-2 hover:bg-gray-300/40 mr-2">
                                                <NavLink to='/notifications' state={nf.notification?.driver}>
                                                    <SlActionRedo />
                                                </NavLink>
                                            </button>
                                            <button
                                                onClick={(e) => handleClearNotification(e, nf._id)}
                                                className="h-8 w-8 flex items-center justify-center bg-transparent border border-black/20 rounded-lg p-2 hover:bg-gray-300/40 text-red-500"
                                            >
                                                <BiXCircle size={18} />
                                            </button>
                                        </div>
                                        <div className="flex justify-end mr-2 mb-2">
                                            <i className="text-xs font-light">
                                                {formatDistanceToNow(new Date(nf.createdAt), { addSuffix: true })}
                                            </i>
                                        </div>
                                    </>
                                );
                            case "deductions":
                                return (
                                    <>
                                        <p className="font-bold">Deduction updated</p>
                                        <p className="text-sm my-1">Id: {nf.notification?.id}</p>
                                        <p className="text-sm my-1">{nf.notification?.message}</p>
                                        <div className='flex gap-3 justify-center'>

                                            <button className="h-8 w-8 flex items-center justify-center bg-transparent border border-black/20 rounded-lg p-2 hover:bg-gray-300/40 mr-2">
                                                <NavLink to={`/deductions`}>
                                                    <SlActionRedo />
                                                </NavLink>
                                            </button>
                                            <button
                                                onClick={(e) => handleClearNotification(e, nf._id)}
                                                className="h-8 w-8 flex items-center justify-center bg-transparent border border-black/20 rounded-lg p-2 hover:bg-gray-300/40 text-red-500"
                                            >
                                                <BiXCircle size={18} />
                                            </button>
                                        </div>
                                        <div className="flex justify-end mr-2 mb-2">
                                            <i className="text-xs font-light">
                                                {formatDistanceToNow(new Date(nf.createdAt), { addSuffix: true })}
                                            </i>
                                        </div>
                                    </>
                                );
                            case "installments":
                                return (
                                    <>
                                        <p className="font-bold">Installment updated</p>
                                        <p className="text-sm my-1">Id: {nf.notification?.id}</p>
                                        <p className="text-sm my-1">{nf.notification?.message}</p>
                                        <div className='flex gap-3 justify-center'>

                                            <button className="h-8 w-8 flex items-center justify-center bg-transparent border border-black/20 rounded-lg p-2 hover:bg-gray-300/40 mr-2">
                                                <NavLink to={`/installments`}>
                                                    <SlActionRedo />
                                                </NavLink>
                                            </button>
                                            <button
                                                onClick={(e) => handleClearNotification(e, nf._id)}
                                                className="h-8 w-8 flex items-center justify-center bg-transparent border border-black/20 rounded-lg p-1 hover:bg-gray-300/40 text-red-500"
                                            >
                                                <BiXCircle size={18} />
                                            </button>
                                        </div>
                                        <div className="flex justify-end mr-2 mb-2">
                                            <i className="text-xs font-light">
                                                {formatDistanceToNow(new Date(nf.createdAt), { addSuffix: true })}
                                            </i>
                                        </div>
                                    </>
                                );
                            case "driverDelete":
                                return currentUser.role === 'super-admin' ? (
                                    <>
                                        <p className="text-sm my-1">{nf.notification.message}</p>
                                        <button
                                            onClick={() => approveDriverDelete(nf._id, nf.notification.driverID)}
                                            className="bg-transparent border border-black/20 rounded-lg p-1 hover:bg-gray-300/40 mr-2"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => denyDriverDelete(nf._id, nf.notification.driverID)}
                                            className="bg-transparent border border-black/20 rounded-lg p-1 hover:bg-gray-300/40 text-red-500"
                                        >
                                            Deny
                                        </button>
                                        <div className="flex justify-end mr-2 mb-2">
                                            <i className="text-xs font-light">
                                                {formatDistanceToNow(new Date(nf.createdAt), { addSuffix: true })}
                                            </i>
                                        </div>
                                    </>
                                ) : null;
                            case "osmDelete":
                                return currentUser.role === 'super-admin' ? (
                                    <>
                                        <p className="font-bold text-sm my-1">{nf.notification.message}</p>
                                        <button
                                            onClick={() => approveOSMDelete(nf._id, nf.notification.userID)}
                                            className="bg-transparent border border-black/20 rounded-lg p-1 hover:bg-gray-300/40 mr-2"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => denyOSMDelete(nf._id, nf.notification.userID)}
                                            className="bg-transparent border border-black/20 rounded-lg p-1 hover:bg-gray-300/40 text-red-500"
                                        >
                                            Deny
                                        </button>
                                        <div className="flex justify-end mr-2 mb-2">
                                            <i className="text-xs font-light">
                                                {formatDistanceToNow(new Date(nf.createdAt), { addSuffix: true })}
                                            </i>
                                        </div>
                                    </>
                                ) : null;
                            case "invoiceApprovalStatus":
                                if (
                                    (currentUser.role === 'OSM' && ['Editing', 'Invoice Generation', 'Complete'].includes(nf.notification.approvalStatus)) ||
                                    (currentUser.role !== 'OSM' && ['Access Requested', 'Under Edit Approval', 'Complete'].includes(nf.notification.approvalStatus))
                                ) {
                                    return (
                                        <>
                                            <p className="font-bold">Invoice approval status updated</p>
                                            <p className="text-sm my-1">
                                                The approval stage for an invoice has progressed to "{nf.notification.approvalStatus}" stage.
                                            </p>
                                            {nf.notification.approvalStatus !== "Complete" ? <p className="text-sm my-1">Your action is needed.</p> : <></>}
                                            <div className="flex justify-end mr-2 mb-2">
                                                <i className="text-xs font-light">
                                                    {formatDistanceToNow(new Date(nf.createdAt), { addSuffix: true })}
                                                </i>
                                            </div>
                                        </>
                                    );
                                } else {
                                    return null;
                                }
                            case "invoiceApprovalStatusBulk":
                                if (
                                    (currentUser.role === 'OSM' && ['Editing', 'Invoice Generation', 'Complete'].includes(nf.notification.approvalStatus)) ||
                                    (currentUser.role !== 'OSM' && ['Access Requested', 'Under Edit Approval', 'Complete'].includes(nf.notification.approvalStatus))
                                ) {
                                    return (
                                        <>
                                            <p className="font-bold">Multiple Invoice approval statuses updated</p>
                                            <p className="text-sm my-1">
                                                The approval stage for multiple invoices has progressed to "{nf.notification.approvalStatus}" stage.
                                            </p>
                                            {nf.notification.approvalStatus !== "Complete" ? <p className="text-sm my-1">Your action is needed.</p> : <></>}
                                            <div className="flex justify-end mr-2 mb-2">
                                                <i className="text-xs font-light">
                                                    {formatDistanceToNow(new Date(nf.createdAt), { addSuffix: true })}
                                                </i>
                                            </div>
                                        </>
                                    );
                                } else {
                                    return null;
                                }
                        }
                    };

                    return (
                        <div
                            key={nf._id}
                            className={`bg-gray-50 border-2 border-gray-200 p-3  rounded-lg shadow-md text-black transition-all duration-500 ${exitingCard === nf._id ? "opacity-0 translate-x-10" : ""}`}
                        >
                            {renderNotificationContent()}
                        </div>
                    );
                })}
            </div>
        </div>
    )
}

export default NotificationPanel;