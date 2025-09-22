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
import BlurModal from '../../components/Modal/BlurModal';
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
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
    const [dailyStackExpenseThisWeek, setDailyStackExpenseThisWeek] = useState({});
    const [additionalChargeTotals, setAdditionalChargeTotals] = useState({ addition: 0, deduction: 0 });
    const [personnelModal, setPersonnelModal] = useState(false);
    const [siteModal, setSiteModal] = useState(false);

    const daysInMonth = moment().daysInMonth();
    const dayLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    const siteColors = [
      '#4F46E5', // Indigo
      '#22C55E', // Green
      '#EAB308', // Amber
      '#EF4444', // Red
      '#06B6D4', // Cyan
      '#A855F7', // Purple
    ];

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
        console.log("PersonnelIds = ", personnelIds);

        let totalExpenses = isOM
            ? Object.fromEntries(selectedSites.map(s => [s, 0]))
            : Object.fromEntries(roles.map(r => [r.roleName, 0]));

        if (personnelIds.length === 0) {
            setTotalExp(totalExpenses);
            setDailyStackExpenseThisWeek({});
            return;
        }

        // Current week bounds (Sun..Sat)
        const startOfWeek = moment().startOf('week').startOf('day');
        const endOfWeek   = moment().endOf('week').endOf('day');
          
        // Prepare accumulator depending on user type
        const segmentWeekTotals = (() => {
          if (isOM) {
            // OM: split by site (selectedSites)
            return selectedSites.reduce((acc, s) => { acc[s] = new Array(7).fill(0); return acc; }, {});
          }
          // Admin/Super Admin: split by role
          const roleNames = roles?.map(r => r.roleName) || ['Compliance','On-Site Manager','Operational Manager'];
          return roleNames.reduce((acc, r) => { acc[r] = new Array(7).fill(0); return acc; }, {});
        })();

        let addTotal = 0;
        let dedTotal = 0;

        try {
            const response = await axios.post(`${API_BASE_URL}/api/weeklyInvoice`, {
                personnelIds: personnelIds,
                serviceWeeks: [moment().format('GGGG-[W]ww')],
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
              const roleName = rec?.personnelId?.role;                // for Admin & super-admin
              const siteKey  = rec?.personnelId?.siteSelection?.[0];  // for OM

              const invArr = Array.isArray(rec?.invoices) ? rec.invoices : [];
              for (const inv of invArr) {
                const dateRaw = inv?.date;
                if (!dateRaw) continue;
                const m = moment(dateRaw);
                if (!m.isValid()) continue;
                if (m.isBefore(startOfWeek) || m.isAfter(endOfWeek)) continue;
              
                const dayIdx = m.day(); // 0..6 (Sun..Sat)
                const amt = Number(inv?.total) || 0;
                
                if (isOM) {
                  // OM: count by site, only OSM invoices on selected sites
                  if (roleName === 'On-Site Manager' && siteKey && selectedSites.includes(siteKey)) {
                    if (!segmentWeekTotals[siteKey]) segmentWeekTotals[siteKey] = new Array(7).fill(0);
                    segmentWeekTotals[siteKey][dayIdx] += amt;
                  }
                } else {
                  // Admin/Super Admin: count by role
                  if (!segmentWeekTotals[roleName]) segmentWeekTotals[roleName] = new Array(7).fill(0);
                  segmentWeekTotals[roleName][dayIdx] += amt;
                }
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
            const r2 = n => Math.round(n * 100) / 100;

            setTotalExp(totalExpenses);
            const rounded = Object.fromEntries(
              Object.entries(segmentWeekTotals).map(([k, arr]) => [k, arr.map(v => r2(v))])
            );
            setDailyStackExpenseThisWeek(rounded);
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

    const countFor = (siteKey, roleName) => {
      const row = roleSiteCounts.find(r => r.role === roleName);
      return row?.[siteKey] ?? 0;
    };

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

    const fmtGBP = (v) => `£${(Number(v) || 0).toFixed(2)}`;
    const fmtHours = (v) => `${(Number(v) || 0).toFixed(2)} h`;

    const chartSx = {
      // Hide hard axis lines and ticks
      '& .MuiChartsAxis-line': { stroke: 'transparent' },
      '& .MuiChartsAxis-tick': { stroke: 'transparent' },
    
      // Axis labels: compact and muted
      '& .MuiChartsAxis-tickLabel': {
        fill: 'rgba(15,23,42,.6)', // slate-900 at ~60%
        fontSize: 12,
        fontWeight: 600,
      },
    
      // Soft horizontal grid (dashed, low-contrast)
      '& .MuiChartsGrid-root line': {
        stroke: 'rgba(148,163,184,.25)', // slate-400 at 25%
        strokeDasharray: '2 6',
      },
    
      // Bars: rounded and with a subtle hover
      '& .MuiBarElement-root': { rx: 10 },
      '& .MuiBarElement-root:hover': { filter: 'brightness(1.05)' },
    };

    // Which roles to show
    const roleRows = isOM ? ['On-Site Manager'] : roles.map(r => r.roleName);

    // Which sites to show
    const siteCols = isOM
      ? selectedSites.map(k => ({
          key: k,
          label: sites.find(s => s.siteKeyword === k)?.siteName || k,
        }))
      : sites.map(s => ({ key: s.siteKeyword, label: s.siteName || s.siteKeyword }));
      
    // Build role × site counts directly from byRole
    const roleSiteCounts = roleRows.map(role => {
      const row = { role, total: 0 };
      for (const { key } of siteCols) {
        const count = (byRole[role] || []).filter(
          p => Array.isArray(p?.siteSelection) && p.siteSelection.includes(key)
        ).length;
        row[key] = count;
        row.total += count;
      }
      return row;
    });

    // Column totals and grand total
    const columnTotals = siteCols.reduce((acc, { key }) => {
      acc[key] = roleSiteCounts.reduce((sum, r) => sum + (r[key] || 0), 0);
      return acc;
    }, {});
    const grandTotal = Object.values(columnTotals).reduce((a, b) => a + b, 0);

    const sliderSettings = {
      className: 'center',
      centerMode: true,
      infinite: siteCols.length > 1,
      slidesToShow: Math.min(siteCols.length, 3),
      centerPadding: '0px',
      speed: 450,
      arrows: true,
      dots: true,
      responsive: [
        { breakpoint: 1024, settings: { slidesToShow: Math.min(siteCols.length, 2) } },
        { breakpoint: 640,  settings: { slidesToShow: 1 } },
      ],
    };

    return (
        <div className='w-full p-4 overflow-auto h-full '>
            <h1 className='text-2xl font-bold dark:text-white'>Welcome back, {userDetails?.userName.split(' ')[0]}</h1>
            <h2 className='text-l text-grey dark:text-white'>Here's an overview of this week's performance.</h2>
                {/* Info cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 m-1 md:m-8 md:mt-4">
                  {informationCardDetails.map((infoCard) => (
                    <button
                      key={infoCard.title}
                      onClick={infoCard.title === 'Total Sites' ? () => setPersonnelModal(true) : undefined}
                      className="group relative w-full rounded-2xl bg-white dark:bg-slate-900
                                 border border-slate-200/80 dark:border-slate-700/70
                                 p-0 text-left shadow-sm hover:shadow-md transition-shadow
                                 ring-2 ring-primary-500/40 dark:ring-offset-slate-900"
                    >
                      {/* Condensed body: smaller padding, smaller fonts, lower min-height */}
                      <div className="flex items-stretch gap-3 p-3 min-h-[72px] md:min-h-[84px]">
                        <div className="flex-1 flex flex-col justify-between gap-0">
                          <div className="flex items-start justify-between">
                            <p className="text-sm md:text-base font-semibold leading-5 text-primary-500 dark:text-slate-100">
                              {infoCard.title}
                            </p>
                          </div>
                          <p className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            {infoCard.info}
                          </p>
                        </div>
                  
                        <div
                          className="w-10 md:w-13 h-10 md:h-13 self-center rounded-xl
                                     bg-slate-100 dark:bg-slate-800
                                     border border-slate-200/70 dark:border-slate-700/70
                                     shadow-sm flex items-center justify-center
                                     [&>*]:h-6 [&>*]:w-6 md:[&>*]:h-8 md:[&>*]:w-8"
                        >
                          {infoCard.icon}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className='flex flex-wrap m-1 mt-4 md:m-8 gap-2 justify-center md:justify-between text-sm'>
                    <div className='grid grid-cols-1 md:grid-cols-12 gap-4 w-full'>
                        {/* Expenses chart */}
                        <div className="flex flex-col md:col-span-3 shadow-lg md:shadow-xl gap-0 w-full pt-0 pr-0 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6">
                          {/* Header: title left, week pill right */}
                          <div className="flex items-center bg-primary-200/30 border-[1.5px] border-primary-500/30 dark:border-primary-200 justify-between p-4 px-6 rounded-t-xl">
                            <p className="text-base md:text-lg font-semibold text-primary-800 dark:text-slate-100">
                              {isOM ? 'Site based Expenses' : 'Role based Expenses'}
                            </p>

                            {/* Week pill (visual only) */}
                            <div className="inline-flex items-center rounded-full border border-slate-300/70 bg-white/70 px-3 py-1
                                            text-xs md:text-sm font-semibold text-slate-700 shadow-sm
                                            dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-200">
                              {moment().format('GGGG-[W]ww')}
                            </div>
                          </div>

                          <div className="pr-8 flex justify-center items-center h-full">
                            {isOM ? (
                              <BarChart
                                xAxis={[{
                                  data: selectedSites,
                                  categoryGapRatio: 0.5,
                                  tickLabelStyle: { fontSize: 12, fontWeight: 600, fill: 'rgba(15,23,42,.7)' },
                                  colorMap: {
                                    type: 'piecewise',
                                    thresholds: [selectedSites[1], selectedSites[2]],
                                    colors: ['#4254FB', '#FFB422', '#FA4F58'],
                                  }
                                }]}
                                yAxis={[{ min: 0, tickLabelStyle: { fontSize: 11, fill: 'rgba(15,23,42,.5)' } }]}
                                series={[{
                                  data: selectedSites.map(s => Number((totalExp?.[s] || 0).toFixed(2))),
                                  valueFormatter: fmtGBP,
                                  highlightScope: { fade: 'global', highlight: 'item' },
                                }]}
                                height={350}
                                borderRadius={12}
                                margin={{ top: 28, right: 16, bottom: 28, left: 28 }}
                                slotProps={{ legend: { hidden: true } }}
                                sx={chartSx}
                              />
                            ) : (
                              <BarChart
                                xAxis={[{
                                  data: ['Compliance', 'OSM', 'Ops Manager'],
                                  tickLabelStyle: { fontSize: 12, fontWeight: 600, fill: 'rgba(15,23,42,.7)' },
                                  categoryGapRatio: 0.5,
                                  colorMap: {
                                    type: 'piecewise',
                                    thresholds: ['OSM', 'Ops Manager'],
                                    colors: ['#4254FB', '#FFB422', '#FA4F58'],
                                  }
                                }]}
                                yAxis={[{ min: 0, tickLabelStyle: { fontSize: 11, fill: 'rgba(15,23,42,.5)' } }]}
                                series={[{
                                  data: [
                                    Number((totalExp['Compliance'] || 0).toFixed(2)),
                                    Number((totalExp['On-Site Manager'] || 0).toFixed(2)),
                                    Number((totalExp['Operational Manager'] || 0).toFixed(2)),
                                  ],
                                  valueFormatter: fmtGBP,
                                  highlightScope: { fade: 'global', highlight: 'item' },
                                }]}
                                height={350}
                                borderRadius={12}
                                margin={{ top: 28, right: 16, bottom: 28, left: 28 }}
                                slotProps={{ legend: { hidden: true } }}
                                sx={chartSx}
                              />
                            )}
                          </div>
                        </div>

                        {/* Hours chart */}
                        <div className='flex flex-col md:col-span-6 shadow-lg md:shadow-xl gap-0 w-full p-0 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className="flex items-center bg-primary-200/30 border-[1.5px] border-primary-500/30 dark:border-primary-200 justify-between p-4 px-6 rounded-t-xl">
                              <p className="text-base md:text-lg font-semibold text-primary-800 dark:text-slate-100">
                                Average Hours Worked
                              </p>

                              {/* Week pill (visual only) */}
                              <div className="inline-flex items-center rounded-full border border-slate-300/70 bg-white/70 px-3 py-1
                                              text-xs md:text-sm font-semibold text-slate-700 shadow-sm
                                              dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-200">
                                {moment().format('GGGG-[W]ww')}
                              </div>
                            </div>
                            <div className='pr-8 flex justify-center items-center h-full'>
                              <LineChart
                                xAxis={[{
                                  data: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                                  scaleType: 'point',
                                  tickLabelStyle: { fontSize: 12, fontWeight: 600, fill: 'rgba(15,23,42,.7)' },
                                }]}
                                yAxis={[{
                                  min: 0,
                                  tickLabelStyle: { fontSize: 11, fill: 'rgba(15,23,42,.55)' },
                                }]}
                                series={[{
                                  data: dailyHoursThisWeek,
                                  area: true,
                                  curve: 'linear',        
                                  color: '#4F46E5',          // match your brand
                                  valueFormatter: fmtHours,  // tooltip format
                                  highlightScope: { fade: 'global', highlight: 'series' },
                                  showMark: true,
                                }]}
                                height={350}
                                margin={{ top: 28, right: 16, bottom: 28, left: 28 }}
                                slotProps={{ legend: { hidden: true } }}
                                sx={{
                                  // hide hard axis lines/ticks
                                  '& .MuiChartsAxis-line': { stroke: 'transparent' },
                                  '& .MuiChartsAxis-tick': { stroke: 'transparent' },
                                
                                  // subtle horizontal grid
                                  '& .MuiChartsGrid-root line': {
                                    stroke: 'rgba(148,163,184,.25)',   // slate-400 @ 25%
                                    strokeDasharray: '2 6',
                                  },
                                
                                  // thicker line
                                  '& .MuiLineElement-root': { strokeWidth: 2.5 },
                                
                                  // clean filled area
                                  '& .MuiAreaElement-root': { opacity: 0.18 },
                                
                                  // small white markers with colored stroke
                                  '& .MuiMarkElement-root': {
                                    r: 3.5,
                                    fill: '#fff',
                                    stroke: '#4F46E5',
                                    strokeWidth: 2,
                                  },
                                }}
                              />
                            </div>
                        </div>
                      
                        <div className='flex flex-col md:col-span-3 gap-3'>
                          {/* Personnel summary */}
                          <div className='flex flex-col gap-2 w-full p-0 pb-2 dark:bg-dark-5 dark:border-dark-6'>
                            {isOM ? (
                              <PieChart
                                series={[{
                                  data: selectedSites.map((siteKey, idx) => ({
                                    id: idx,
                                    label: siteKey,
                                    value: filteredPersonnels.filter(p => Array.isArray(p.siteSelection) && p.siteSelection.includes(siteKey)).length,
                                  })),
                                  innerRadius: 35,
                                  outerRadius: 70,
                                  cornerRadius: 5,
                                  paddingAngle: 3,
                                  highlightScope: { fade: 'global', highlight: 'item' },
                                  faded: { innerRadius: 40, additionalRadius: -10, color: 'gray' },
                                }]}
                                height={175}
                                width={Math.max(175, selectedSites.length * 80)}
                              />
                            ) : (
                              <PieChart
                                series={[{
                                  data: [
                                    { id: 0, value: byRole['Compliance']?.length || 0, label: `Compliance (${byRole['Compliance']?.length})` },
                                    { id: 1, value: byRole['On-Site Manager']?.length || 0, label: `On-Site Manager (${byRole['On-Site Manager']?.length})` },
                                    { id: 2, value: byRole['Operational Manager']?.length || 0, label: `Operational Manager (${byRole['Operational Manager']?.length})` },
                                  ],
                                  innerRadius: 35,
                                  outerRadius: 70,
                                  cornerRadius: 5,
                                  paddingAngle: 3,
                                  highlightScope: { fade: 'global', highlight: 'item' },
                                  faded: { innerRadius: 40, additionalRadius: -10, color: 'gray' },
                                }]}
                                height={175}
                                width={175}
                              />
                            )}
                          </div>

                          {/* Attendance summary */}
                          <div className='flex flex-row gap-0 w-full p-0 pb-2 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                              <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1, md: 1 }} alignItems="center"
                                      justifyContent="center"
                                      sx={{ width: '100%' }}
                                      paddingTop={1}>
                                  <Gauge width={200} height={200} value={attendance} innerRadius="60%" outerRadius="90%" cornerRadius="50%" 
                                          sx={{
                                           '& .MuiGauge-valueText': {
                                             fontSize: 25,
                                             transform: 'translate(0px, 0px)',
                                           },
                                          }}
                                          text={({ value }) => `${value} %`}/>
                                  <div className='flex flex-col items-center gap-0 dark:border-primary-200 p-2 rounded-t-xl'>
                                    <h2 className='text-center font-bold w-full text-lg font-bold text-primary-500'>Attendance for</h2>
                                    <h2 className='text-center font-bold w-full'>{moment().format('GGGG-[W]ww')}</h2>
                                  </div>
                              </Stack>
                          </div>
                        </div>

                        {/* Current Week – Daily Expense (stacked) */}
                        <div className='flex flex-col md:col-span-9 shadow-lg md:shadow-xl gap-3 w-full p-0 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                          <div className="flex items-center bg-primary-200/30 border-[1.5px] border-primary-500/30 dark:border-primary-200 justify-between p-4 px-6 rounded-t-xl">
                            <p className="text-base md:text-lg font-semibold text-primary-800 dark:text-slate-100">
                              {isOM ? "Daily Expense by Site" : "Daily Expense by Role"}
                            </p>
                          
                            {/* Week pill (visual only) */}
                            <div className="inline-flex items-center rounded-full border border-slate-300/70 bg-white/70 px-3 py-1
                                            text-xs md:text-sm font-semibold text-slate-700 shadow-sm
                                            dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-200">
                              {moment().format('GGGG-[W]ww')}
                            </div>
                          </div>
                          <div className='pr-8 flex justify-center items-center h-full'>
                            {(() => {
                              const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                            
                              // Segment labels: sites for OM, roles otherwise
                              const segmentNames = isOM
                                ? selectedSites
                                : (roles?.map(r => r.roleName) || Object.keys(dailyStackExpenseThisWeek || {}));
                            
                              const series = segmentNames.map((name) => ({
                                label: isOM
                                  ? (sites.find(s => s.siteKeyword === name)?.siteName || name)
                                  : name,
                                data: (dailyStackExpenseThisWeek?.[name] || new Array(7).fill(0)),
                                valueFormatter: fmtGBP,
                              }));
                            
                              return (
                                <BarChart
                                  xAxis={[{
                                    data: days,
                                    tickLabelStyle: { fontSize: 12, fontWeight: 600, fill: 'rgba(15,23,42,.7)' },
                                  }]}
                                  yAxis={[{
                                    min: 0,
                                    tickLabelStyle: { fontSize: 11, fill: 'rgba(15,23,42,.5)' },
                                  }]}
                                  series={series}
                                  height={350}
                                  borderRadius={12}
                                  margin={{ top: 28, right: 16, bottom: 28, left: 28 }}
                                  slotProps={{ legend: { hidden: false } }}
                                  sx={chartSx}
                                />
                              );
                            })()}
                          </div>
                        </div>

                        {/* Additional Charges chart */}
                        <div className='flex flex-col md:col-span-3 shadow-lg md:shadow-xl gap-3 w-full p-0 bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6'>
                            <div className="flex items-center bg-primary-200/30 border-[1.5px] border-primary-500/30 dark:border-primary-200 justify-between p-4 px-6 rounded-t-xl">
                              <p className="text-base md:text-lg font-semibold text-primary-800 dark:text-slate-100">
                                Additional Charges
                              </p>
                            
                              {/* Week pill (visual only) */}
                              <div className="inline-flex items-center rounded-full border border-slate-300/70 bg-white/70 px-3 py-1
                                              text-xs md:text-sm font-semibold text-slate-700 shadow-sm
                                              dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-200">
                                {moment().format('GGGG-[W]ww')}
                              </div>
                            </div>
                            <BarChart
                                xAxis={[{ data: ['Addition', 'Deduction'], tickLabelStyle: { fontSize: 12, fontWeight: 600, fill: 'rgba(15,23,42,.7)' }, categoryGapRatio: 0.7,
                                 colorMap: {
                                    type: 'piecewise',
                                    thresholds: ['Deduction'],
                                    colors: ['#4fc033ff', '#FA4F58'],
                                  }
                                }]}
                                yAxis={[{
                                  min: 0,
                                  tickLabelStyle: { fontSize: 11, fill: 'rgba(15,23,42,.5)' },
                                }]}
                                series={[{ data: [additionalChargeTotals.addition, additionalChargeTotals.deduction] }]}
                                height={350}
                                borderRadius={12}
                                margin={{ top: 28, right: 16, bottom: 28, left: 28 }}
                                slotProps={{ legend: { hidden: true }}}  // ensure no legend noise
                                sx={chartSx}
                            />
                        </div>
                    </div>
                </div>
                <BlurModal isOpen={personnelModal} onClose={() => setPersonnelModal(false)}>
                  <div className="p-2 md:p-10 mx-auto overflow-hidden max-w-[75rem]">
                    <Slider {...sliderSettings} className="site-cards-slider">
                      {siteCols.map(({ key: siteKey, label }) => (
                        // Each direct child of <Slider> is one slide
                        <div key={siteKey}>
                          <div className="flex flex-col shadow-lg md:shadow-xl bg-white/30 border-[1.5px] border-neutral-200 rounded-xl dark:bg-dark-5 dark:border-dark-6
                                          h-full mx-auto">
                            {/* Card header */}
                            <div className="flex flex-col p-4 gap-1 w-full bg-primary-200/30 border-b-[1.5px] border-primary-500/30 dark:border-primary-200 rounded-t-xl items-center">
                              <p className="text-lg font-bold text-primary-500">{label}</p>
                              <p className="text-xs text-primary-700/70 dark:text-primary-200/70">{siteKey}</p>
                            </div>
                      
                            {/* Role rows with counts */}
                            <div className="px-4 py-3">
                              {roleRows.map((roleName) => (
                                <div key={`${siteKey}-${roleName}`} className="flex items-center justify-between py-2 border-b border-neutral-200/50 last:border-b-0">
                                  <span className="text-sm">{roleName}</span>
                                  <span className="inline-flex min-w-[2rem] justify-center rounded-md bg-primary-200/60 px-2 py-0.5 text-xs font-semibold text-primary-900 dark:text-primary-100">
                                    {countFor(siteKey, roleName)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </Slider>
                    
                    {/* Scale/opacity emphasis on the centered slide */}
                    <style>{`
                      .site-cards-slider .slick-track { display: flex; align-items: stretch;  }
                      .site-cards-slider .slick-slide { padding: 0 12px; }
                      .site-cards-slider .slick-slide > div { display: flex; } /* allow card to stretch */
                      .site-cards-slider .slick-slide { transform: scale(.85); opacity: .65; transition: transform .35s ease, opacity .35s ease; }
                      .site-cards-slider .slick-center { transform: scale(1.05); opacity: 1; z-index: 2; }
                      .site-cards-slider .slick-list { overflow: visible !important; padding-top: 16px; padding-bottom: 16px; }
                      .site-cards-slider .slick-track { overflow: visible; }
                      .site-cards-slider .slick-dots { bottom: -36px; }
                      .site-cards-slider { position: relative; }
                      .site-cards-slider .slick-prev,
                      .site-cards-slider .slick-next {
                        z-index: 20 !important;
                        pointer-events: auto;
                      }
                    `}</style>
                  </div>
          </BlurModal>
        </div >
    );
};

export default Dashboard;