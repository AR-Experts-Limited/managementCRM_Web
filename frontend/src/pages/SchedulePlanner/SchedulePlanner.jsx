import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { NavLink } from "react-router-dom";
import TableStructure from '../../components/TableStructure/TableStructure';
import { calculateAllWorkStreaks, checkAllContinuousSchedules } from '../../utils/scheduleCalculations';
import moment from 'moment';
import axios from 'axios';
import { FaTrashAlt } from "react-icons/fa";
import { FaPlus } from "react-icons/fa";
import { IoIosAddCircle, IoIosAddCircleOutline } from "react-icons/io";
import { RiCheckDoubleLine } from "react-icons/ri";
import { FaHourglassStart } from "react-icons/fa";
import Modal from '../../components/Modal/Modal'
import { addSchedule, deleteSchedule } from '../../features/schedules/scheduleSlice';
import InputGroup from '../../components/InputGroup/InputGroup'
import InputWrapper from '../../components/InputGroup/InputWrapper';
import { fetchPersonnels } from '../../features/personnels/personnelSlice';
import { fetchRoles } from '../../features/roles/roleSlice';
import { fetchSites } from '../../features/sites/siteSlice';
import TrashBin from '../../components/UIElements/TrashBin'
import { RiZzzFill } from "react-icons/ri";
import { cn } from '../../lib/utils'
import { MultiGrid, AutoSizer } from "react-virtualized";
import "react-virtualized/styles.css";
import { debounce } from 'lodash'; // or import from './utils/debounce';
import Exclamation from '../../components/UIElements/Exclamation';
import { IoMoonOutline, IoMoon, IoSunny } from "react-icons/io5";
import { ImageViewer } from './ImageViewer';
const API_BASE_URL = import.meta.env.VITE_API_URL;

const getPersonnelSiteForDate = (personnel, date) => {
    const traces = personnel?.siteTrace || [];
    if (traces.length === 0) {
        return personnel?.siteSelection[0];
    }

    const targetDate = new Date(date)
    // Sort traces by timestamp
    const sortedTraces = traces
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let latestSite = null;

    for (const trace of sortedTraces) {
        const changeDate = new Date(trace.timestamp);
        if (changeDate <= targetDate) {
            if (
                !latestSite ||
                changeDate > new Date(latestSite.timestamp)
            ) {
                latestSite = trace;
            }
        }
    }

    if (latestSite) {
        return latestSite.to;
    }

    // If no change has occurred yet, return the 'from' type of the first trace
    const firstTrace = sortedTraces
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];

    if (targetDate < new Date(firstTrace.timestamp)) {
        return firstTrace.from;
    }

    return personnel?.siteSelection;
};

const getPersonnelTypeForDate = (personnel, date) => {

    const dateKey = moment(date).format('D/M/YYYY');
    // 1. Custom override
    if (personnel?.customTypeOfPersonnel?.[dateKey]) {
        return personnel.customTypeOfPersonnel[dateKey];
    }

    const traces = personnel?.typeOfPersonnelTrace || [];
    if (traces.length === 0) {
        return personnel?.typeOfPersonnel;
    }

    const parseTraceDate = (ts) => {
        const [day, month, year] = ts.split('/');
        return new Date(`${year}-${month}-${day}`).setHours(0, 0, 0, 0);
    };

    const targetDate = new Date(date);
    let latestTrace = null;
    for (const trace of traces) {
        const changeDate = parseTraceDate(trace.timestamp);
        if (changeDate <= targetDate) {
            if (
                !latestTrace ||
                changeDate > parseTraceDate(latestTrace.timestamp)
            ) {
                latestTrace = trace;
            }
        }
    }

    if (latestTrace) {
        return latestTrace.to;
    }

    // If no change has occurred yet, return the 'from' type of the first trace
    const firstTrace = traces
        .slice()
        .sort((a, b) => parseTraceDate(a.timestamp) - parseTraceDate(b.timestamp))[0];

    if (targetDate < parseTraceDate(firstTrace.timestamp)) {
        return firstTrace.from;
    }

    // Fallback
    return personnel?.typeOfPersonnel;
};

const SchedulePlanner = () => {
    const dispatch = useDispatch();
    const { userDetails } = useSelector((state) => state.auth);
    const [rangeType, setRangeType] = useState('weekly');
    const [rangeOptions, setRangeOptions] = useState({});
    const [selectedRangeIndex, setSelectedRangeIndex] = useState();
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedSite, setSelectedSite] = useState('')
    const [personnelsList, setPersonnelsList] = useState([])
    const [searchPersonnel, setSearchPersonnel] = useState('')
    const [days, setDays] = useState([])
    const [loading, setLoading] = useState(false)
    const { personnelStatus } = useSelector((state) => state.personnels);
    const personnelsByRole = useSelector((state) => state.personnels.byRole);
    const { list: sites, siteStatus } = useSelector((state) => state.sites)
    const { list: roles, roleStatus } = useSelector((state) => state.roles)

    const state = { rangeType, rangeOptions, selectedRangeIndex, days, searchPersonnel, personnelsList, selectedRole, selectedSite }
    const setters = { setRangeType, setRangeOptions, setSelectedRangeIndex, setDays, setSearchPersonnel, setPersonnelsList, setSelectedRole, setSelectedSite }

    const [schedules, setSchedules] = useState([])
    const [scheduleMap, setScheduleMap] = useState({});

    const [cacheRangeOption, setCacheRangeOption] = useState(null)
    const [prevRangeType, setPrevRangeType] = useState(rangeType)

    const [addScheduleData, setAddScheduleData] = useState(null)
    const { events, connected } = useSelector((state) => state.sse);

    const loadingTimeoutRef = useRef(null);
    const prevPersonnelsList = useRef(personnelsList);
    const [toastOpen, setToastOpen] = useState(false)

    console.log('personnelsList:', personnelsList);
    console.log('days:', days);

    useEffect(() => {
        if (events && (events.type === "scheduleAdded")) {
            console.log("Schedule Updated ! Refetching...");
            const addedSchedule = events.data;

            setSchedules(prev => [...prev, addedSchedule])

        }

        if (events && (events.type === "scheduleDeleted")) {
            console.log("Schedule Deleted ! Refetching...");
            const deletedSchedule = events.data;

            setSchedules(prev => prev.filter((item) => item._id !== deletedSchedule._id))

        }
    }, [events]);

    useEffect(() => {
        if (personnelStatus === 'idle') dispatch(fetchPersonnels());
        if (siteStatus === 'idle') dispatch(fetchSites())
        if (roleStatus === 'idle') dispatch(fetchRoles());
    }, [personnelStatus, siteStatus, roleStatus, dispatch]);

    useEffect(() => {
        if (userDetails?.role === 'super-admin' || userDetails?.role === 'Admin') {
            const filteredPersonnels = selectedRole
                ? personnelsByRole[selectedRole] || []
                : Object.values(personnelsByRole).flat();
            setPersonnelsList(filteredPersonnels);
        }
    }, [personnelsByRole, selectedRole]);

    useEffect(() => {
        let allPersonnels = Object.values(personnelsByRole ?? {}).flat();
        if (userDetails.role == 'Operational Manager') {
            allPersonnels = allPersonnels.filter(p => p.role == 'On-Site Manager');
        }   

        const filtered = selectedSite
          ? allPersonnels.filter(personnel => personnel.siteSelection.includes(selectedSite))
          : allPersonnels;  
        setPersonnelsList(filtered);
    }, [selectedSite, personnelsByRole, userDetails?.role]);


    const ScheduleStatus = () => {
        return (
            <div className='flex items-center justify-around bg-neutral-100/90 border-[1.5px] border-neutral-300/90 shadow rounded-lg w-full mb-2 p-1 text-sm font-light' >
                <p>Date: <span className='shadow-md ml-2 inline-block min-w-8 text-center text-xs font-semibold bg-primary-100/20 border-[1.5px] border-primary-500 text-primary-500 rounded-md px-1 py-0.5'>{moment().format('DD/MM/YYYY')}</span></p>
                <p>Total Schedules: <span className='shadow-md ml-2 inline-block min-w-8 text-center text-xs font-semibold bg-primary-100/20 border-[1.5px] border-primary-500 text-primary-500 rounded-md px-1 py-0.5'>{schedules.filter((sc) => moment(sc.day).format('YYYY-MM-DD') === moment().format('YYYY-MM-DD')).length}</span></p>
                <div className='flex items-center'>
                    Personnels
                    <div className='ml-2 border-[1.5px] border-primary-500/40 w-10 h-0'></div>
                    <div className='flex gap-5 border-[1.5px] border-primary-500/40 rounded-lg py-1 px-3'>
                        <p>Active: <span className='shadow-md ml-2 inline-block min-w-8 text-center text-xs font-semibold bg-green-300/20 border-[1.5px] border-green-700 text-green-700 rounded-md px-1 py-0.5'>{personnelsList.filter((d) => !['Inactive', 'Archived'].includes(d.activeStatus) && !d.disabled).length}</span></p>
                        <p >Inactive: <span className='shadow-md ml-2 inline-block min-w-8 text-center text-xs font-semibold bg-red-300/20 border-[1.5px] border-red-700 text-red-600 rounded-md px-1 py-0.5'>{personnelsList.filter((d) => d.activeStatus === 'Inactive' && !d.disabled).length}</span></p>
                        <p >Archived: <span className='shadow-md ml-2 inline-block min-w-8 text-center text-xs font-semibold bg-amber-300/20 border-[1.5px] border-amber-700 text-amber-600 rounded-md px-1 py-0.5'>{personnelsList.filter((d) => d.activeStatus === 'Archived' && !d.disabled).length}</span></p>
                        <p >Suspended: <span className='shadow-md ml-2 inline-block min-w-8 text-center text-xs font-semibold bg-red-300/20 border-[1.5px] border-red-700 text-red-600 rounded-md px-1 py-0.5'>{personnelsList.filter((d) => d.suspended === 'Suspended' && !d.disabled).length}</span></p>
                    </div>
                </div>
            </div >
        )
    }


    useEffect(() => {
        const fetchSchedules = async () => {
            if (personnelsList.length === 0 || !rangeOptions) return;

            // Check if personnelsList has changed by comparing with previous value
            const personnelsListChanged = JSON.stringify(personnelsList) !== JSON.stringify(prevPersonnelsList.current);
            prevPersonnelsList.current = personnelsList;

            const shouldLoad =
                personnelsListChanged ||
                !cacheRangeOption ||
                !Object.keys(cacheRangeOption).includes(selectedRangeIndex) ||
                Object.keys(cacheRangeOption).indexOf(selectedRangeIndex) === 0 ||
                Object.keys(cacheRangeOption).indexOf(selectedRangeIndex) === Object.keys(cacheRangeOption).length - 1;

            if (shouldLoad) {
                loadingTimeoutRef.current = setTimeout(() => {
                    setLoading(true);
                }, 350);
            }

            try {
                const rangeOptionsVal = Object.values(rangeOptions);
                const response = await axios.post(`${API_BASE_URL}/api/live-ops/fetchappdata`, {
                        personnelId: personnelsList.map((personnel) => personnel._id),
                        startDay: new Date(moment(rangeOptionsVal[0]?.start).format('YYYY-MM-DD')),
                        endDay: new Date(moment(rangeOptionsVal[rangeOptionsVal.length - 1]?.end).format('YYYY-MM-DD')),
                    },
                );

                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;

                setSchedules(response.data);
                setCacheRangeOption(rangeOptions);
            } catch (error) {
                clearTimeout(loadingTimeoutRef.current);
                loadingTimeoutRef.current = null;

                console.error(error);
            } finally {
                setLoading(false);
            }
        };



        const debouncedFetchSchedules = debounce(fetchSchedules, 20);
        // Check if rangeOptions change requires a fetch
        // const shouldFetchRange =
        //     !cacheRangeOption ||
        //     !Object.keys(cacheRangeOption).includes(selectedRangeIndex) ||
        //     Object.keys(cacheRangeOption).indexOf(selectedRangeIndex) === 0 ||
        //     Object.keys(cacheRangeOption).indexOf(selectedRangeIndex) === Object.keys(cacheRangeOption).length - 1;

        // Fetch if personnelsList changed or rangeOptions change requires it

        debouncedFetchSchedules();
        return () => debouncedFetchSchedules.cancel(); // Cleanup on unmount
    }, [rangeOptions, personnelsList]);

    useEffect(() => {
        let map = {}
        schedules.forEach(sch => {
            const dateKey = new Date(sch.date).toLocaleDateString('en-UK'); // normalize date
            const key = `${dateKey}_${sch.personnel_id}`;
            map[key] = sch;
            console.log("Key = ", key, " for schedule ", sch);
        });
        setScheduleMap(map)
        console.log("Schedule Map = ", map);
    }, [schedules])

    useEffect(() => {
        if (rangeType !== prevRangeType) {
            setCacheRangeOption(rangeOptions)
            setPrevRangeType(rangeType)
        }
    }, [rangeOptions])


    const handleDownloadCSV = (rows, filename, columns) => {
        if (!rows || rows.length === 0) return;

        const cols = Array.isArray(columns) && columns.length
            ? columns
            : Object.keys(rows[0]);

        const esc = (v) => {
            if (v == null) return '';
            const s = String(v);
            const needsQuotes = /[",\n]/.test(s);
            const escaped = s.replace(/"/g, '""');
            return needsQuotes ? `"${escaped}"` : escaped;
        };

        const header = cols.join(',');
        const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n');

        // Add BOM so Excel opens UTF-8 cleanly
        const csv = '\uFEFF' + header + '\n' + body;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // Function to handle downloading CSV for a specific day
    const handleDownloadDayCSV = (day) => {
        const raw = day?.date || '';
        const dateOnly = raw.includes(',') ? raw.split(',')[1].trim() : raw;

        const target = moment(
            dateOnly,
            ['DD/MM/YYYY', 'YYYY-MM-DD', 'D MMM YYYY', 'DD MMM YYYY', 'ddd, DD MMM YYYY'],
            true
        );
        if (!target.isValid()) {
            setToastOpen({
                content: (
                    <>
                        <Exclamation width={25} height={25} />
                        <p className='text-sm font-bold text-red-500'>Invalid date format</p>
                    </>
                )
            });
            setTimeout(() => setToastOpen(null), 3000);
            return;
        }

        const daySchedules = schedules.filter(s =>
            moment(s.day).format('YYYY-MM-DD') === target.format('YYYY-MM-DD')
        );


        if (daySchedules.length === 0) {
            setToastOpen({
                content: (
                    <>
                        <Exclamation width={25} height={25} />
                        <p className='text-sm font-bold text-red-500'>No schedules found for the date</p>
                    </>
                )
            });
            setTimeout(() => setToastOpen(null), 3000);
            return;
        }

        // dedupe by personnelId logic
        const pickScore = (sch) =>
            (sch.site === selectedSite ? 2 : 0) +
            (!['standby', 'Voluntary-Day-off'].includes(sch.service) ? 10 : 0);

        const byPersonnel = {};
        for (const s of daySchedules) {
            if (!byPersonnel[s.personnelId] || pickScore(s) > pickScore(byPersonnel[s.personnelId])) {
                byPersonnel[s.personnelId] = s;
            }
        }
        const uniqueSchedules = Object.values(byPersonnel);

        // ---- helpers for grouping & sorting ----
        const toNum = (v) => (v === '2' || v === 2 ? 2 : 1);
        const isDayOff = (s) => s?.service === 'Voluntary-Day-off';
        const isStandby = (s) => s?.standby || s?.service === 'standby';
        // Broader match for Remote Debrief variants
        const isRemoteDebrief = (s) =>
        typeof s?.service === 'string' && s.service.toLowerCase().includes('remote debrief');

        // Group order: 1=Cycle1, 2=Cycle2, 3=Standby, 4=Day-off, 5=Remote Debrief (you can move 5 if you want a different order)
        const groupRankOf = (s) => {
        if (isDayOff(s)) return 4;
        if (isStandby(s)) return 3;
        if (isRemoteDebrief(s)) return 5;
        return toNum(s?.cycle) === 2 ? 2 : 1;
        };

        const personnelNameOf = (s) => {
        const d = personnelsList.find((x) => x._id === s.personnelId);
        return d ? `${d.firstName || ''} ${d.lastName || ''}`.trim() : 'Unknown';
        };

        // Sort by group rank, then personnel name (case-insensitive)
        const sortedSchedules = [...uniqueSchedules].sort((a, b) => {
        const ga = groupRankOf(a), gb = groupRankOf(b);
        if (ga !== gb) return ga - gb;
        return personnelNameOf(a).localeCompare(personnelNameOf(b), 'en', { sensitivity: 'base' });
        });

        // ---- Insert one section title per group ----
        const groupedRows = [];
        let currentGroup = null;

        sortedSchedules.forEach((s) => {
        const g = groupRankOf(s);
        if (g !== currentGroup) {
            if (g === 1) groupedRows.push({ "Personnel Name": "*** CYCLE 1 ***" });
            if (g === 2) groupedRows.push({ "Personnel Name": "*** CYCLE 2 ***" });
            if (g === 5) groupedRows.push({ "Personnel Name": "*** REMOTE DEBRIEF ***" });
            if (g === 3) groupedRows.push({ "Personnel Name": "*** STANDBY ***" });
            if (g === 4) groupedRows.push({ "Personnel Name": "*** DAY-OFF ***" });
            currentGroup = g; // <-- important
        }
        groupedRows.push(s);
        });

        // ---- Build CSV rows ----
        const csvData = groupedRows.map((s) => {
        // Section header row
        if (!s.personnelId) {
            return {
            'Personnel Name': s["Personnel Name"],
            "Personnel's Site": '',
            'Scheduled Date': '',
            'Service': '',
            'Cycle': ''
            };
        }

        const personnel = personnelsList.find((d) => d._id === s.personnelId);
        const isStandalone = !['standby', 'Voluntary-Day-off'].includes(s.service) && !s.standby;
        const cycleDisplay = isStandalone ? (s.cycle ? `Cycle ${s.cycle}` : 'Cycle 1') : '';

        return {
            'Personnel Name': personnel ? `${personnel.firstName} ${personnel.lastName}` : 'Unknown',
            "Personnel's Site": personnel?.siteSelection || '',
            'Scheduled Date': target.format('DD/MM/YYYY'),
            'Service': s.standby
            ? 'On Standby'
            : (s.service === 'Voluntary-Day-off'
                ? 'Voluntary-Day-off'
                : (s.site === selectedSite ? s.service : `stand-by working on (${s.site}) ${s.service}`)),
            'Cycle': cycleDisplay,
        };
        });

        const cols = ['Personnel Name', "Personnel's Site", 'Scheduled Date', 'Service', 'Cycle'];
        handleDownloadCSV(csvData, `Schedules_${target.format('DD-MM-YYYY')}_${target.format('GGGG-[W]ww')}.csv`, cols);
    };

    // Pre-calculate all streaks and continuous schedule statuses
    const { streaks, continuousStatus } = useMemo(() => {
        if (personnelsList.length === 0 || schedules.length === 0) {
            return { streaks: {}, continuousStatus: {} };
        }

        const sortedSchedules = [...schedules].sort((a, b) => new Date(a.day) - new Date(b.day));
        const streaks = calculateAllWorkStreaks(personnelsList, sortedSchedules);
        const continuousStatus = checkAllContinuousSchedules(personnelsList, schedules, days.map((day) => day.date));

        return { streaks, continuousStatus };
    }, [personnelsList, schedules, days]);


    const handleAddSchedule = async () => {
        try {
            const newSchedule = await dispatch(addSchedule({
                personnelId: addScheduleData.personnel._id,
                day: new Date(addScheduleData.date).toUTCString(),
                user_ID: addScheduleData.personnel.user_ID,
                associatedRateCard: addScheduleData.associatedRateCard,
                week: addScheduleData.week,
                acknowledged: false,
                cycle: addScheduleData?.cycle || 1,
                addedBy: {
                    userName: userDetails.userName, addedOn: new Date()
                }
            })).unwrap();
            if (!connected) setSchedules(prev => [...prev, newSchedule])
            setAddScheduleData(null)
        }
        catch (err) {
            alert('Schedule exist for selected personnel and date')
        }
    }

    const handleDeleteSchedule = async (id) => {
        await axios.delete(`${API_BASE_URL}/api/live-ops/${id}`);
        //if (!connected) setSchedules(prev => prev.filter((item) => item._id !== id))
        setSchedules(prev => prev.filter((item) => item._id !== id))
    }

    const handleAddWorkDay = async (personnel, day) => {
        console.log("Personnel = ", personnel, "\nDay = ", day);
        const insertData = await axios.post(`${API_BASE_URL}/api/live-ops`, {
            personnel_id: personnel._id,
            date: new Date(day.date).toUTCString(),
            user_ID: personnel.user_ID,
            week: day.week
        });
        console.log("Insert Data = ", insertData.data);
        setSchedules(prev => [...prev, insertData.data]);
    }

    useEffect(() => {
      if (userDetails?.role === 'Operational Manager' && !selectedSite) {
        setSelectedSite(userDetails?.siteSelection?.[0] || '');
      }
    }, [userDetails, selectedSite, setSelectedSite]);

    const tableData = (personnel, day, disabledPersonnel ) => {

        const personnelSite = getPersonnelSiteForDate(personnel, day.date);

        const getBorderColor = (streak) => {
            if (streak < 3) return 'border-l-green-500/60';
            if (streak < 5) return 'border-l-yellow-500/60';
            return 'border-l-red-400';
        };

        const renderDeleteButton = (onClick) => (
            <div
                onClick={onClick}
                className="absolute z-1 right-0 top-0 h-full flex items-center justify-center bg-red-500 text-white p-2 pl-2.5 rounded-r-md inset-shadow-md hover:bg-red-400 transition-all duration-300 opacity-0 group-hover:opacity-100 active:opacity-100 focus:opacity-100 cursor-pointer"
            >
                <FaTrashAlt size={14} />
            </div>
        );

        const renderScheduleBox = ({ schedule, streak, showSite = true }) => {
            const borderColor = getBorderColor(streak);
            return (
                <div className="relative flex justify-center h-full w-full group">
                    <div className="relative w-40 max-w-40">
                        <div className={`relative z-6 w-full h-full flex gap-1 items-center justify-between overflow-auto dark:bg-dark-4 dark:text-white bg-gray-100 border border-gray-200 dark:border-dark-5 border-l-4 ${borderColor} rounded-md text-sm p-2 transition-all duration-300 ${(scheduleBelongtoSite && schedule.status === 'not_started') || ['super-admin', 'Admin'].includes(userDetails?.role) || (['Operational Manager'].includes(userDetails?.role) && schedule.trip_status == 'not_started') ? 'group-hover:w-[82%]' : ''}`}
                                    onClick={() => setAddScheduleData(schedule)}>
                            <div className="overflow-auto max-h-[6rem]">
                                {schedule.trip_status == 'not_started' ? "Not Started" : schedule.trip_status == 'in_progress' ? "In Progress" : "Completed" }
                            </div>
                            <div className='flex flex-col gap-1 items-center justify-center'>
                                <div className="h-7 w-7 flex justify-center items-center bg-white border border-stone-200 shadow-sm rounded-full p-1">
                                    {schedule.trip_status == 'not_started' ? <FaHourglassStart className={'text-yellow-400'} size={15}/> : schedule.trip_status == 'in_progress' ? <svg className="w-6 h-6" viewBox="0 0 80 50" xmlns="http://www.w3.org/2000/svg">
                                                <polyline
                                                    points="0,25 20,25 30,05 40,40 50,10 60,25 100,25"
                                                    className="ecg-path stroke-orange-500 stroke-[7] fill-none"
                                                />
                                            </svg> : <RiCheckDoubleLine className={'text-green-400'} size={18} /> }
                                </div>
                            </div>
                        </div>
                        {
                            renderDeleteButton((e) => {
                                e.stopPropagation();
                                handleDeleteSchedule(schedule._id);
                            })
                        }
                    </div>
                </div>
            );
        };

        const renderStandbyCell = (personnel, dateObj) => (
            <div className="relative flex justify-center h-full w-full group">
                <div className="relative w-40 max-w-40 w-full">
                    <div className="relative z-6 w-full h-full flex gap-1 items-center justify-center overflow-auto dark:bg-dark-4 dark:text-white bg-gray-50 border border-amber-100 dark:border-dark-5 rounded-md text-sm p-2 transition-all duration-300 group-hover:w-[82%] bg-[repeating-linear-gradient(-45deg,#ffb9008f_0px,#ffb9008f_2px,transparent_2px,transparent_6px)]">
                        <div className="overflow-auto max-h-[4rem] bg-amber-400/50 rounded-md px-2 py-1 text-amber-700">On Stand-By</div>
                    </div>
                    {renderDeleteButton((e) => {
                        e.stopPropagation();
                        handleStandbyToggle(personnel, dateObj);
                    })}
                </div>
            </div>
        );

        const renderPlaceholder = () => (
            <div className="w-full h-full flex items-center justify-center text-stone-400">
                <div className="flex justify-center items-center w-full h-full rounded-md border-dashed border-gray-200 bg-[repeating-linear-gradient(-45deg,#e4e4e4_0px,#e4e4e4_2px,transparent_2px,transparent_6px)]" >
                    {(getPersonnelSiteForDate(personnel, new Date(day.date)) !== selectedSite) && <div className="w-fit text-sm text-center text-white bg-stone-300 px-1 py-0.5 rounded-md">
                        {getPersonnelSiteForDate(personnel, new Date(day.date))}
                    </div>}
                </div>
            </div>
        );

        const renderClickableCell = (personnel, day) => (
            <div
                onClick={() =>
                    handleAddWorkDay(personnel, day)
                }
                className="cursor-pointer flex h-full w-full justify-center items-center"
            >
                <div className="group flex justify-center items-center h-full w-40 rounded-md max-w-40 hover:bg-stone-100">
                    <div className="hidden group-hover:flex items-center justify-center w-6 h-6 leading-none bg-gray-50 border border-neutral-200 rounded">
                        <FaPlus className="w-3 h-3 shrink-0" />
                    </div>
                </div>
            </div>
        );

        const dateObj = new Date(day.date);
        const dateKey = dateObj.toLocaleDateString('en-UK');
        const key = `${dateKey}_${personnel._id}`;

        const schedule = scheduleMap[key];
        const streak = streaks[personnel._id]?.[dateKey] || 0;
        const continuousSchedule = continuousStatus[personnel._id]?.[dateKey] || "3";

        const scheduleBelongtoSite = schedule?.site === selectedSite;

        let content = null;

        if (loading) {
            content = <div className='h-full w-full rounded-md bg-gray-200 animate-pulse'></div>
        }

        else {
            if (userDetails?.role === 'Operational Manager') {
                if (getPersonnelSiteForDate(personnel, new Date(day.date)) !== selectedSite) {
                    content = renderPlaceholder();
                } 
                else if (schedule) {
                    content = renderScheduleBox({ schedule, scheduleBelongtoSite, streak });
                } else if (disabledPersonnel) {
                    content = renderPlaceholder();
                } else if (continuousSchedule < 3) {
                    const label = continuousSchedule === "1" ? 'Unavailable' : 'Day-off';
                    content = (
                        <div className="flex justify-center items-center w-full h-full rounded-lg border-dashed border-gray-200 bg-[repeating-linear-gradient(-45deg,#e4e4e4_0px,#e4e4e4_2px,transparent_2px,transparent_6px)]">
                            <div className="text-sm text-center text-white bg-stone-300 px-1 py-0.5 rounded-md">
                                {label}
                            </div>
                        </div>
                    );
                } else {
                    content = renderClickableCell(personnel, day);
                }
            }

            else {
                if (schedule) {
                    content = renderScheduleBox({ schedule, streak });
                } else if (disabledPersonnel) {
                    content = renderPlaceholder();
                }  else {
                    content = renderClickableCell(personnel, day);
                }
            }
        }


        return (
            <div className={`flex justify-center items-center h-full w-full `} >
                {content}
            </div>
        );
    };


    return (
        <>
            <div className={`${toastOpen ? 'opacity-100 translate-y-16' : 'opacity-0'} transition-all ease-in duration-200 border border-stone-200 fixed flex justify-center items-center z-50 backdrop-blur-sm top-4 left-1/2 -translate-x-1/2 bg-stone-400/20 dark:bg-dark/20 p-3 rounded-lg shadow-lg`}>
                <div className='flex gap-4 justify-around items-center'>
                    {toastOpen?.content}
                </div>
            </div>
            < TableStructure title={'Schedule Planner'} state={state} setters={setters} tableData={tableData} onDownloadDayCSV={handleDownloadDayCSV} ScheduleStatus={ScheduleStatus} />
            <Modal isOpen={addScheduleData && userDetails.role !== 'Operational Manager'} >
                <div className="border border-neutral-300 rounded-lg w-full max-w-4xl mx-auto">
                    <div className="px-8 py-4 border-b border-neutral-300">
                        <h2 className="text-xl font-semibold">Shift Details</h2>
                    </div>  
                    <div className="mx-6 p-3 space-y-4">
                        {/* Date and User ID Row */}
                        <div className="flex flex-row justify-between gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date:</label>
                                <p>{new Date(addScheduleData?.date).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">User ID:</label>
                                <p>{addScheduleData?.user_ID}</p>
                            </div>
                        </div>  
                        {/* Shift Time Row */}
                        <div className="flex flex-row justify-between gap-4">
                            <div className="flex flex-col">
                                <p className="text-sm font-medium text-gray-700">Shift Start Time:</p>
                                <input
                                    value={
                                        addScheduleData?.start_trip_checklist?.time_and_date 
                                            ? new Date(addScheduleData?.start_trip_checklist?.time_and_date).toLocaleString('en-UK')
                                            : addScheduleData?.trip_status == 'in_progress' ? '--Shift in progress--' : '--Not Started--'
                                        }
                                    disabled
                                    className="mt-1 px-3 py-2 bg-gray-100 border border-neutral-200 rounded-md text-sm"
                                />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-sm font-medium text-gray-700">Shift End Time:</p>
                                <input
                                    value={
                                        addScheduleData?.end_trip_checklist?.time_and_date
                                            ? new Date(addScheduleData.end_trip_checklist.time_and_date).toLocaleString('en-UK')
                                            : addScheduleData?.trip_status == 'in_progress' ? '--Shift in progress--' : '--Not Started--'
                                        }
                                    disabled
                                    className="mt-1 px-3 py-2 bg-gray-100 border border-neutral-200 rounded-md text-sm"
                                />
                            </div>
                        </div>  
                        <ImageViewer
                            userId={addScheduleData?.user_ID}
                            date={new Date(addScheduleData?.date)}
                            checklist={addScheduleData?.start_trip_checklist}
                            title="Shift Start"
                        />
                        <ImageViewer
                            userId={addScheduleData?.user_ID}
                            date={new Date(addScheduleData?.day)}
                            checklist={addScheduleData?.end_trip_checklist}
                            title="Shift End"
                        />
                    </div>  
                    {/* Footer */}
                    <div className="px-6 py-2 border-t border-neutral-300 flex justify-end">
                        <button
                            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                            onClick={() => { setAddScheduleData(null); }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default SchedulePlanner;