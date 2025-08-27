import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FiUserCheck, FiMapPin } from "react-icons/fi";
import { PiCardholder } from "react-icons/pi";
import { AiOutlineStock } from "react-icons/ai";
import { TbMap } from "react-icons/tb";
import {
    fetchPersonnels,
    addPersonnel,
    updatePersonnel,
    deletePersonnel,
} from '../../features/personnels/personnelSlice';

import { fetchSites } from '../../features/sites/siteSlice';
import { fetchRoles } from  '../../features/roles/roleSlice';
import moment from 'moment'
import axios from 'axios'
import InputWrapper from '../../components/InputGroup/InputWrapper';
const API_BASE_URL = import.meta.env.VITE_API_URL;


const Dashboard = () => {
    const dispatch = useDispatch();
    const { byRole, personnelStatus, addStatus, deleteStatus, error } = useSelector((state) => state.personnels);
    const { list: sites, siteStatus } = useSelector((state) => state.sites)
    const { list: roles, roleStatus } = useSelector((state) => state.roles)
    const [totalExp, setTotalExp] = useState(0)
    const [totalRevenue, setTotalRevenue] = useState(0)
    const [schedules, setSchedules] = useState([])
    const { userDetails } = useSelector((state) => state.auth);


    useEffect(() => {
        if (personnelStatus === 'idle') dispatch(fetchPersonnels());
        if (siteStatus === 'idle') dispatch(fetchSites())
        if (roleStatus === 'idle') dispatch(fetchRoles())
    }, [personnelStatus, siteStatus, roleStatus, dispatch]);

    const fetchSchedules = async () => {
        let personnelsList = []
        personnelsList = byRole.flat() || []

        try {
            const response = await axios.get(`${API_BASE_URL}/api/schedule/filter1`, {
                params: {
                    personnelId: personnelsList.map((personnel) => personnel._id),
                    startDay: new Date(new Date().setHours(0, 0, 0, 0)),
                    endDay: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            });
            setSchedules(response.data);
        } catch (error) {
            console.error(error);

        };



    }

    const fetchWeeklyInvoices = async () => {

        const personnelsList = Object.values(byRole).flat() || [];
        const personnelIds = personnelsList.map((personnel) => personnel._id);

        let totalExpenses = Object.fromEntries(
            roles.map(r => [r.roleName, 0])
        );
        if (personnelIds.length === 0) return;

        try {
            const response = await axios.get(`${API_BASE_URL}/api/weeklyInvoice`, {
                params: {
                    serviceWeeks: [moment().format('GGGG-[W]ww')],
                }
            });
            const weeklyInvoices = response.data.data;
            console.log("Fetched weeklyInvoices - ", weeklyInvoices);

            //Total Expenses Calculation
            totalExpenses = weeklyInvoices.reduce((sum, inv) => {
                sum[inv.personnelId?.role] = (sum[inv.personnelId?.role] || 0) + inv.total;
                return sum;
            }, {...totalExpenses});


            console.log("Total expenses = ", totalExpenses);
            setTotalExp(totalExpenses);

        }
        catch (error) {
            console.error("Error fetching weekly invoices:", error);
        }
    }

    const fetchProfitLoss = async () => {

        try {
            // Ensure the API accepts 'week' as a query parameter
            const response = await axios.get(`${API_BASE_URL}/api/profitloss`, {
                params: { week: moment().format('GGGG-[W]ww') },
            });

            const sitePL = sites.reduce((acc, site) => {
                acc[site.siteKeyword] = 0;
                return acc;
            }, {});

            // Sum profit/loss values per site for the selected week
            response.data.forEach((item) => {
                if (item.week === moment().format('GGGG-[W]ww') && sitePL[item.site] !== undefined) {
                    sitePL[item.site] += item.profitLoss;
                }
            });
            setTotalRevenue(sitePL);
        } catch (error) {
            console.error("Error fetching Profit/Loss data:", error);
        }
    };

    useEffect(() => {
        fetchWeeklyInvoices()
        fetchProfitLoss()
    }, [])

    const informationCardDetails = [
        { title: 'Total Personnels', icon: <FiUserCheck size={20} />, info: Object.values(byRole).flat().filter((personnel) => !personnel.disabled).length },
        { title: 'Total Sites', icon: <TbMap size={20} />, info: sites.length },
        { title: `Overall Expenses for ${moment().format('GGGG-[W]ww')}`, icon: <AiOutlineStock size={20} />, info: '£' + Object.values(totalExp).reduce((sum, exp) => sum + exp, 0)?.toFixed(2) },
        { title: `Overall Revenue for ${moment().format('GGGG-[W]ww')}`, icon: <AiOutlineStock size={20} />, info: '£' + Object.values(totalRevenue).reduce((total, revenue) => total + revenue, 0)?.toFixed(2) },
    ]
    return (
        <div className='w-full p-4 overflow-auto h-full '>
            <h2 className='text-xl font-bold dark:text-white'>Dashboard</h2>
                    {/* Info cards */}
                    < div className='flex flex-wrap gap-2 m-1 md:m-8  justify-center md:justify-between'>
                        {informationCardDetails.map((infoCard) => (
                            <div className='flex items-center gap-3 w-full md:w-60 p-4 overflow-auto bg-primary-200/30 border-[1.5px] border-primary-500/30 text-primary-500 rounded-xl shadow-lg md:shadow-xl dark:text-primary-200 dark:border-primary-200 '>
                                <div className='flex items-center justify-center p-5 h-15 bg-white inset-shadow-sm/30 border-[1.5px] border-primary-500/40 rounded-xl'>{infoCard.icon}</div>
                                <div className='flex flex-col gap-1 '>
                                    <p className='text-sm text-center font-bold'>{infoCard.title}</p>
                                    <p className='text-center text-2xl text-white font-bold'>{infoCard.info}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Role cards */}
                    <div className='flex flex-wrap m-1 mt-4 md:m-8 gap-2 justify-center md:justify-between text-sm'>
                        {roles.map((role, index) => (
                            <div className='flex flex-col shadow-lg md:shadow-xl items-center gap-3 w-full md:w-60 p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                                <div className='flex items-center gap-2 '>
                                    <div><FiMapPin size={17} /></div>
                                    <p className='text-center font-bold'>{role.roleName}</p>
                                </div>
                                <div>
                                    <p className='my-2'>Total Personnels: {byRole[role.roleName]?.length || 0}</p>
                                    <p className='my-2'>Total Expenses: £ {totalExp[role.roleName]?.toFixed(2)}</p>
                                    <p className='my-2'>{totalRevenue[role.roleName] > 0 && `Total Profitable Revenue: £ ${totalRevenue[role.roleName]?.toFixed(2)}`}</p>
                                </div>
                            </div>
                        ))}
                    </div>
        </div >
    );
};

export default Dashboard;