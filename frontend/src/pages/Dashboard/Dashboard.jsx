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
import { Gauge } from '@mui/x-charts/Gauge';
import Stack from '@mui/material/Stack';
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
    const [attendance, setAttendance] = useState();
    const [dailyExpenseThisMonth, setDailyExpenseThisMonth] = useState([]);
    const [additionalChargeTotals, setAdditionalChargeTotals] = useState({ addition: 0, deduction: 0 });

    const daysInMonth = moment().daysInMonth();
    const dayLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

    // Derived helpers
    const isOM = userDetails?.role === 'Operational Manager';
    const selectedSites = isOM
      ? (Array.isArray(userDetails?.siteSelection) ? userDetails.siteSelection
         : userDetails?.site ? [userDetails.site] : [])
      : [];

    // Flatten personnels once
    const allPersonnels = Object.values(byRole).flat() || [];

    // Filtered personnels for OM: only OSMs on selected sites; otherwise everyone
    const filteredPersonnels = isOM
      ? allPersonnels.filter(p =>
          Array.isArray(p?.siteSelection) &&
          p.siteSelection.some(s => selectedSites.includes(s)) &&
          p.role === 'On-Site Manager'
        )
      : allPersonnels;

    useEffect(() => {
        if (personnelStatus === 'idle') dispatch(fetchPersonnels());
        if (siteStatus === 'idle') dispatch(fetchSites())
        if (roleStatus === 'idle') dispatch(fetchRoles())
    }, [personnelStatus, siteStatus, roleStatus, dispatch]);

    const fetchAppData = async () => {
      try {
        const ids = filteredPersonnels.map(p => p._id);
        console.log("Number of Personnel = ", ids.length)

        if (ids.length === 0) {
          setDailyHoursThisWeek([0, 0, 0, 0, 0, 0, 0]); // Sun..Sat
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
        const localShiftCount = {};

        completed.forEach(r => {
          const start = new Date(r.start_trip_checklist.time_and_date);
          const end   = new Date(r.end_trip_checklist.time_and_date);
          localShiftCount[r.personnel_id] = (localShiftCount[r.personnel_id] || 0) + 1;

          console.log("Trip:", r._id, "Start:", start, "End:", end);

          const hours = Math.max(0, (end - start) / (1000 * 60 * 60));

          // Sunday=0 .. Saturday=6 (moment().day() follows this convention)
          const dayIndex = moment(start).day();

          if (dayIndex >= 0 && dayIndex < 7) {
            hoursByDay[dayIndex] += Math.round(hours * 100) / 100;
          }
        });

        const avgShiftCount = Object.values(localShiftCount).reduce((a, b) => a + b, 0) / Math.max(ids.length, 1);
        console.log("Avg Shift Count = ", avgShiftCount);
        const avgShiftPercentage = (avgShiftCount / 5) * 100; // Assuming 5 shifts a week
        setAttendance(avgShiftPercentage);

        const avgHoursByDay = hoursByDay.map(h => Math.round((h / Math.max(completed.length, 1)) * 100) / 100);
        setDailyHoursThisWeek(avgHoursByDay);
        console.log("Shift Count = ", localShiftCount);

      } catch (error) {
        console.error('Error fetching appData', error);
      }
    };

    const fetchWeeklyInvoices = async () => {

        const personnelsBase = isOM ? filteredPersonnels : allPersonnels;
        const personnelIds = personnelsBase.map(p => p._id);

        let totalExpenses = isOM
            ? Object.fromEntries(selectedSites.map(s => [s, 0]))
            : Object.fromEntries(roles.map(r => [r.roleName, 0]));

        if (personnelIds.length === 0) {
            setTotalExp(totalExpenses);
            return;
        }

        const daysInMonth = moment().daysInMonth();
        const dailyTotals = new Array(daysInMonth).fill(0);
        let addTotal = 0;
        let dedTotal = 0;

        try {
            const response = await axios.get(`${API_BASE_URL}/api/weeklyInvoice`, {
                params: {
                    serviceWeeks: [moment().format('GGGG-[W]ww')],
                }
            });
            const weeklyInvoices = response.data.data || [];
            console.log("Fetched weeklyInvoices - ", weeklyInvoices);

            if (isOM) {
              // Only OSM invoices on selected sites; aggregate by site
              totalExpenses = weeklyInvoices.reduce((sum, inv) => {
                const siteKey = inv?.personnelId?.siteSelection?.[0];
                const role = inv?.personnelId?.role;
                if (role === 'On-Site Manager' && siteKey && selectedSites.includes(siteKey)) {
                  sum[siteKey] = (sum[siteKey] || 0) + (inv.total || 0);
                }
                return sum;
              }, { ...totalExpenses });
            } else {
              // Keep your previous "non-OM" logic (by first site)
              totalExpenses = weeklyInvoices.reduce((sum, inv) => {
                const key = inv?.personnelId?.role; // you previously keyed by role for non-OM
                sum[key] = (sum[key] || 0) + (inv.total || 0);
                return sum;
              }, { ...totalExpenses });
            }

            for (const rec of weeklyInvoices) {
              const invArr = Array.isArray(rec?.invoices) ? rec.invoices : [];
              for (const inv of invArr) {

                const dateRaw = inv?.date;
                console.log("Invoice Date Raw - ", dateRaw);
                if (!dateRaw) continue;
            
                const m = moment(dateRaw);
                if (!m.isValid()) continue;
                if (!m.isSame(moment(), 'month')) continue; // only current month
            
                const dayIdx = m.date() - 1; // 0-based index
                if (dayIdx < 0 || dayIdx >= daysInMonth) continue;
            
                const amt = Number(inv?.total) || 0;
                console.log("Invoice Amount - ", inv?.total);
                console.log(`  Adding £${amt} to day index ${dayIdx}`);
                dailyTotals[dayIdx] += amt;
              }

              const items = Array.isArray(rec?.additionalChargesDetail)
                ? rec.additionalChargesDetail
                : Array.isArray(rec?.additionalChargesDetail) // if some payloads use PascalCase
                  ? rec.AdditionalChargesDetail
                  : [];
                      
              for (const ch of items) {
                const t = String(ch?.type || '').toLowerCase();   // "addition" | "deduction"
                const rate = Number(ch?.rate) || 0;
              
                if (t.includes('add')) addTotal += rate;
                else if (t.includes('deduct')) dedTotal += rate;
              }
            }
        
            // Round to 2dp for display safety
            const dailyTotals2dp = dailyTotals.map(v => Math.round(v * 100) / 100);
            const r2 = n => Math.round(n * 100) / 100;

            setTotalExp(totalExpenses);
            setDailyExpenseThisMonth(dailyTotals2dp);
            setAdditionalChargeTotals({ addition: r2(addTotal), deduction: r2(dedTotal) });
            console.log("Total Expenses - ", totalExpenses);

        }
        catch (error) {
            console.error("Error fetching weekly invoices:", error);
        }
    }

    const fetchProfitLoss = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/profitloss`, {
          params: { week: moment().format('GGGG-[W]ww') },
        });

        const sitePL = isOM
          ? selectedSites.reduce((acc, s) => { acc[s] = 0; return acc; }, {})
          : sites.reduce((acc, site) => { acc[site.siteKeyword] = 0; return acc; }, {});

        response.data.forEach(item => {
          const isThisWeek = item.week === moment().format('GGGG-[W]ww');
          if (!isThisWeek) return;

          const siteKey = item.site;
          if (sitePL[siteKey] !== undefined) {
            sitePL[siteKey] += item.profitLoss || 0;
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

    const totalPersonnelsCount = (isOM
      ? filteredPersonnels
      : allPersonnels
    ).filter(p => !p?.disabled).length;

    const totalSitesCount = isOM ? selectedSites.length : sites.length;

    const informationCardDetails = [
        { title: 'Total Personnels', icon: <FiUserCheck size={20} />, info: totalPersonnelsCount },
        { title: 'Total Sites', icon: <TbMap size={20} />, info: totalSitesCount },
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
                    <div className='grid grid-cols-1 md:grid-cols-12 gap-4 w-full'>
                        
                        {/* Expenses chart */}
                        <div className='flex flex-col md:col-span-4 shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                          <div className='flex items-center gap-2 w-full'>
                            <h2 className='text-center font-bold w-full'>
                              {isOM ? 'Site-based Expenses' : `Role based Expenses for ${moment().format('GGGG-[W]ww')}`}
                            </h2>
                          </div>

                          {isOM ? (
                            <BarChart
                              xAxis={[{ data: selectedSites }]}
                              series={[{
                                data: selectedSites.map(s => Number((totalExp?.[s] || 0).toFixed(2)))
                              }]}
                              borderRadius={10}
                              height={300}
                            />
                          ) : (
                            <BarChart
                              xAxis={[{ data: ['Compliance', 'On-Site Manager', 'Operational Manager'] }]}
                              series={[{
                                data: [
                                  Number((totalExp['Compliance'] || 0).toFixed(2)),
                                  Number((totalExp['On-Site Manager'] || 0).toFixed(2)),
                                  Number((totalExp['Operational Manager'] || 0).toFixed(2)),
                                ]
                              }]}
                              borderRadius={10}
                              height={300}
                            />
                          )}
                        </div>
                      
                        {/* Personnel summary */}
                        <div className='flex flex-col md:col-span-4 shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                          <div className='flex items-center gap-2 w-full'>
                            <h2 className='text-center font-bold w-full'>Personnel Summary</h2>
                          </div>
                      
                          {isOM ? (
                            <PieChart
                              series={[{
                                data: selectedSites.map((siteKey, idx) => ({
                                  id: idx,
                                  label: siteKey,
                                  value: filteredPersonnels.filter(p => Array.isArray(p.siteSelection) && p.siteSelection.includes(siteKey)).length,
                                })),
                                innerRadius: 40,
                                outerRadius: 80,
                                cornerRadius: 5,
                                paddingAngle: 3,
                                highlightScope: { fade: 'global', highlight: 'item' },
                                faded: { innerRadius: 40, additionalRadius: -10, color: 'gray' },
                              }]}
                              height={200}
                              width={Math.max(200, selectedSites.length * 80)}
                            />
                          ) : (
                            <PieChart
                              series={[{
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
                              }]}
                              height={200}
                              width={200}
                            />
                          )}
                        </div>

                        <div className='flex flex-col md:col-span-2 shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className='flex items-center gap-2 w-full'>
                                <h2 className='text-center font-bold w-full'>Attendance for {moment().format('GGGG-[W]ww')}</h2>
                            </div>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 3 }} alignItems="center"
                                    justifyContent="center"
                                    sx={{ width: '100%' }}
                                    paddingTop={4}>
                                <Gauge width={200} height={200} value={attendance} innerRadius="60%" outerRadius="90%" cornerRadius="50%" 
                                        sx={{
                                         '& .MuiGauge-valueText': {
                                           fontSize: 25,
                                           transform: 'translate(0px, 0px)',
                                         },
                                        }}
                                        text={({ value }) => `${value} %`}/>
                            </Stack>
                        </div>

                        <div className='flex flex-col md:col-span-2 shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className='flex items-center gap-2 w-full'>
                                <h2 className='text-center font-bold w-full'>Additional Charges for {moment().format('GGGG-[W]ww')}</h2>
                            </div>
                            <BarChart
                                xAxis={[{ data: ['Addition', 'Deduction'] }]}
                                series={[{ data: [additionalChargeTotals.addition, additionalChargeTotals.deduction] }]}
                                borderRadius={10}
                                height={300}
                            />
                        </div>

                        <div className='flex flex-col md:col-span-4 shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className='flex items-center gap-2 w-full'>
                                <h2 className='text-center font-bold w-full'>Average Hours Worked for {moment().format('GGGG-[W]ww')}</h2>
                            </div>
                            <LineChart
                                xAxis={[{ data: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], scaleType: 'point' }]}
                                series={[{ data: dailyHoursThisWeek, connectNulls: true, area: true, curve: 'linear' }]}
                                height={300}
                            />
                        </div>

                        <div className='flex flex-col md:col-span-8 shadow-lg md:shadow-xl gap-3 w-full p-4 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className='flex items-center gap-2 w-full'>
                                <h2 className='text-center font-bold w-full'>Monthly Expense - {moment().format('MMMM YYYY')}</h2>
                            </div>
                            <BarChart
                                xAxis={[{ data: dayLabels }]}
                                series={[{ data: dailyExpenseThisMonth }]}
                                borderRadius={10}
                                height={300}
                            />
                        </div>
                    </div>
                    
                </div>
        </div >
    );
};

export default Dashboard;