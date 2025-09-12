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
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
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
    const [dailyHoursThisWeek, setDailyHoursThisWeek] = useState([0, 0, 0, 0, 0, 0, 0]);

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

    const fetchAppData = async () => {
      try {
        const personnelsList = Object.values(byRole).flat() || [];
        const ids = personnelsList.map(p => p._id);

        if (ids.length === 0) {
          setDailyHoursThisWeek([0, 0, 0, 0, 0, 0, 0]); // Sun..Sat
          setWeeklyAverages([]);
          return;
        }

        // Current week: Sunday 00:00 → Saturday 23:59:59.999
        const startOfWeek = moment().startOf('week').startOf('day');   // Sunday
        const endOfWeek   = moment().endOf('week').endOf('day');       // Saturday

        const res = await axios.post(`${API_BASE_URL}/api/live-ops/fetchappdata`, {
          personnelId: ids,
          startDay: startOfWeek.toDate().toISOString(),
          endDay: endOfWeek.toDate().toISOString(),
        });

        const rows = Array.isArray(res.data) ? res.data : [];

        // Completed trips with valid timestamps
        const completed = rows.filter(r =>
          r?.trip_status === 'completed' &&
          r?.start_trip_checklist.time_and_date &&
          r?.end_trip_checklist.time_and_date
        );

        // Initialize Sun..Sat buckets
        const hoursByDay = new Array(7).fill(0); // Sunday=0 .. Saturday=6

        completed.forEach(r => {
          const start = new Date(r.start_trip_checklist.time_and_date);
          const end   = new Date(r.end_trip_checklist.time_and_date);

          console.log("Trip:", r._id, "Start:", start, "End:", end);

          const hours = Math.max(0, (end - start) / (1000 * 60 * 60));

          // Sunday=0 .. Saturday=6 (moment().day() follows this convention)
          const dayIndex = moment(start).day();

          if (dayIndex >= 0 && dayIndex < 7) {
            hoursByDay[dayIndex] += Math.round(hours * 100) / 100;
          }
        });

        const avgHoursByDay = hoursByDay.map(h => Math.round((h / completed.length) * 100) / 100);
        setDailyHoursThisWeek(avgHoursByDay);

      } catch (error) {
        console.error('Error fetching appData', error);
      }
    };

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

            setTotalExp(totalExpenses);
            console.log("Total Expenses - ", totalExpenses);

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

    useEffect(() => {
      const anyPersonnels = Object.values(byRole).some(arr => (arr || []).length > 0);
      if (anyPersonnels) fetchAppData();
    }, [byRole]);

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
                
                <div className='flex flex-wrap m-1 mt-4 md:m-8 gap-2 justify-center md:justify-between text-sm'>
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4 w-full'>
                        <div className='flex flex-col shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className='flex items-center gap-2 w-full'>
                                <h2 className='text-center font-bold w-full'>Role based Expenses for {moment().format('GGGG-[W]ww')}</h2>
                            </div>
                            <BarChart
                                xAxis={[{ data: ['Compliance', 'On-Site Manager', 'Operational Manager'] }]}
                                series={[{ data: [totalExp['Compliance']?.toFixed(2), totalExp['On-Site Manager']?.toFixed(2), totalExp['Operational Manager']?.toFixed(2)] }]}
                                borderRadius={10}
                                height={300}
                            />
                        </div>

                        <div className='flex flex-col shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className='flex items-center gap-2 w-full'>
                                <h2 className='text-center font-bold w-full'>Personnel Summary</h2>
                            </div>
                            <PieChart
                                series={[
                                  {
                                    data: [
                                        { id: 0, value: byRole['Compliance']?.length || 0, label: 'Compliance' },
                                        { id: 1, value: byRole['On-Site Manager']?.length || 0, label: 'On-Site Manager' },
                                        { id: 2, value: byRole['Operational Manager']?.length || 0, label: 'Operational Manager' },
                                    ],
                                    innerRadius: 40,
                                    outerRadius: 80,
                                    cornerRadius: 5,
                                    paddingAngle: 3,
                                    highlightScope: { fade: 'global', highlight: 'item' },
                                    faded: { innerRadius: 40, additionalRadius: -10, color: 'gray' },
                                  },
                                ]}
                                height={200}
                                width={200}
                            />
                        </div>

                        <div className='flex flex-col shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className='flex items-center gap-2 w-full'>
                                <h2 className='text-center font-bold w-full'>Average Hours Worked for {moment().format('GGGG-[W]ww')}</h2>
                            </div>
                            <LineChart
                                xAxis={[{ data: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], scaleType: 'point' }]}
                                series={[{ data: dailyHoursThisWeek, connectNulls: true, area: true, curve: 'linear' }]}
                                height={300}
                            />
                        </div>
                    </div>
                    
                </div>
        </div >
    );
};

export default Dashboard;