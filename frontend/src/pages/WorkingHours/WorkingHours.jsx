import React, { useEffect, useMemo, useState , useRef} from 'react';
import axios from 'axios';
import { FixedSizeList } from 'react-window';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPersonnels } from '../../features/personnels/personnelSlice';
import moment from 'moment';
import Modal from '../../components/Modal/Modal';
import DatePicker from '../../components/Datepicker/Datepicker';
import WeekInput from '../../components/Calendar/WeekInput';
import { AutoSizer } from 'react-virtualized';
import TableFeatures from '../../components/TableFeatures/TableFeatures';
import { fetchSites } from '../../features/sites/siteSlice';
import { fetchRoles } from '../../features/roles/roleSlice';
import * as XLSX from 'xlsx';
import { IoCalendarOutline } from "react-icons/io5";
import flatpickr from "flatpickr";
import { TiDelete } from "react-icons/ti";
import "flatpickr/dist/flatpickr.min.css";
import { cn } from "../../lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_URL;

// --- helpers ---
const getDateFromMaybeMongo = (v) => {
  // supports { $date: ISO } or ISO string / Date
  if (!v) return null;
  if (v?.$date) return new Date(v.$date);
  return new Date(v);
};

const toStartOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
};

const toEndOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23,59,59,999);
  return x;
};

const DatePickerLocal = ({ id, label, iconPosition, name, value, minDate, maxDate, required, onChange, error, disabled }) => {
    const flatpickrRef = useRef(null);
    const flatpickrInstance = useRef(null);
    const [date, setDate] = useState("");

    const handleDateChange = (selectedDates) => {
        if (selectedDates.length > 0) {
            setDate(selectedDates[0]);
            onChange(selectedDates[0])
        } else {
            setDate("");
        }
    };

    const handleClearDate = () => {
        flatpickrInstance.current.clear();
        setDate("");
        if (onChange) onChange("");
    };

    useEffect(() => {
        if (flatpickrRef.current) {
            flatpickrInstance.current = flatpickr(flatpickrRef.current, {
                mode: "single",
                monthSelectorType: "dropdown",
                position: "auto",
                minDate: minDate,
                disableMobile: true,
                maxDate: maxDate,
                onChange: handleDateChange,
            });

            return () => {
                flatpickrInstance.current.destroy(); // Cleanup to prevent memory leaks
            };
        }
    }, []);

    useEffect(() => {
        if (flatpickrRef.current) {
            flatpickrInstance.current?.set({
                minDate: minDate,
                maxDate: maxDate,
            });
        }

    }, [minDate, maxDate])

    useEffect(() => {
        setDate(value);
    }, [value]);

    return (
        <div>
            <label htmlFor={id} className={`${disabled ? 'text-gray-200' : 'text-dark'} text-body-sm font-medium  dark:text-white`}>
                {label}
                {required && <span className="ml-1 select-none text-red">*</span>}
            </label>
            <div
                className={cn(
                    "relative [&_svg]:absolute [&_svg]:top-1/2 [&_svg]:-translate-y-1/2",
                    iconPosition === "left" ? "[&_svg]:left-4.5" : "[&_svg]:right-4.5"
                )}
            >
                <input
                    ref={flatpickrRef}
                    name={name}
                    className={cn("flatpickr form-datepicker w-full rounded-lg border-[1.5px] border-neutral-300 bg-white px-5.5 py-3.5 h-13 outline-none transition focus:border-primary-500 active:border-primar-500 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary pl-12.5", error ? 'border-[1.5px] border-red animate-pulse' : '')}
                    placeholder="mm/dd/yyyy"
                    required={required}
                    disabled={disabled}
                    value={date ? new Date(date).toLocaleDateString().split('T')[0] : ''} //
                />


                {date ? <TiDelete onClick={handleClearDate} className="size-7 cursor-pointer text-red-light" /> : <IoCalendarOutline className="pointer-events-none size-5 text-neutral-300" />}

            </div>
        </div>
    );
};

const WorkingHours = () => {
    const dispatch = useDispatch();
    const { userDetails } = useSelector((state) => state.auth);
    const { list: sites, siteStatus } = useSelector((state) => state.sites);
    const { list: roles, roleStatus } = useSelector((state) => state.roles);
    const personnelsByRole = useSelector((state) => state.personnels.byRole);

    const [selectedRole, setSelectedRole] = useState('');
    const [selectedWeek, setSelectedWeek] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [invoice, setInvoice] = useState([]);
    const [filteredInvoices, setFilteredInvoices] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchColumn, setSearchColumn] = useState('personnelName');
    const [toastOpen, setToastOpen] = useState(null);
    const [repopulate, setRepopulate] = useState(false);
    const [rangeType, setRangeType] = useState("weekly");

    const [personnelsList, setPersonnelsList] = useState([]);

    const columns = {
        "Personnel Name": "personnelName",
        "Role": "role",
        "Date": "date",
        "Hours Worked": "comments"
    }

    const [displayColumns, setDisplayColumns] = useState(columns);

    useEffect(() => {
        if (siteStatus === 'idle') dispatch(fetchSites())
        if (roleStatus === 'idle') dispatch(fetchRoles());
        dispatch(fetchPersonnels());
    }, [siteStatus, roleStatus, dispatch]);

    useEffect(() => {
        const currentWeek = moment().format('YYYY-[W]WW');
        const currentDate = new Date();
        setSelectedWeek(currentWeek);
        setSelectedDate(currentDate);
    }, []);

    // keep personnels list in sync with role
    useEffect(() => {
        if (!personnelsByRole) return;
        const list = selectedRole
          ? (personnelsByRole[selectedRole] || [])
          : Object.values(personnelsByRole).flat();
        setPersonnelsList(list);
    }, [personnelsByRole, selectedRole]);

    const getWeekRange = (weekStr) => {
        const m = moment(weekStr, 'YYYY-[W]WW');
        const start = m.startOf('isoWeek').toDate();
        const end = m.endOf('isoWeek').toDate();
        return { start, end };
    };

    const buildDateWindow = () => {
        if (rangeType === 'daily' && selectedDate) {
            return { start: toStartOfDay(selectedDate), end: toEndOfDay(selectedDate) };
        }
        const { start, end } = getWeekRange(selectedWeek);
        return { start: toStartOfDay(start), end: toEndOfDay(end) };
    };

    const computeActualHours = (rec) => {
        const start = getDateFromMaybeMongo(rec?.start_trip_checklist?.time_and_date);
        const end = getDateFromMaybeMongo(rec?.end_trip_checklist?.time_and_date);
        if (!start || !end) return 0;
        let hours = (end.getTime() - start.getTime()) / 3600000;
        if (rec?.end_trip_checklist?.one_hour_break) hours -= 1;
        return Math.max(0, Number.isFinite(hours) ? hours : 0);
    };

    const fetchAppData = async () => {
        try {
            const ids = personnelsList.map(p => p._id);
            if (ids.length === 0) {
                setInvoice([]);
                setFilteredInvoices([]);
                return;
            }

            const { start, end } = buildDateWindow();

            const res = await axios.post(`${API_BASE_URL}/api/live-ops/fetchappdata`, {
                personnelId: ids,
                startDay: new Date(moment(start).format('YYYY-MM-DD')),
                endDay: new Date(moment(end).format('YYYY-MM-DD')),
            });

            const rawData = res.data.filter(row => row.trip_status == 'completed') || [];
            const processedData = preprocessAppData(rawData);
            setInvoice(processedData);
            filterAndSetInvoices(processedData);
            setRepopulate(true);
        } catch (error) {
            console.error('Error fetching appData', error);
            setToastOpen({ content: 'Failed to load working hours.' });
            setTimeout(() => setToastOpen(null), 3000);
        }
    };

    useEffect(() => {
        if ((selectedRole !== undefined) && (selectedWeek || selectedDate)) {
            fetchAppData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRole, selectedWeek, selectedDate, rangeType, personnelsList]);

    const preprocessAppData = (data) => {
        // Map over AppData records and normalize into the table row shape used by this component
        return data.map(item => {
            const person = personnelsList.find(p => p._id === item.personnel_id);
            const personName = person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : 'Unknown';
            const role = person?.role || '-';

            const actualHours = computeActualHours(item);
            const expectedHours = 9; // default target when schedule info not present

            const hasBothTimes = !!(item?.start_trip_checklist?.time_and_date && item?.end_trip_checklist?.time_and_date);

            const hoursWorked = (item?.end_trip_checklist?.time_and_date - item?.start_trip_checklist?.time_and_date)/3600000;

            return {
                _id: item._id,
                personnelName: personName,
                role: role,
                date: item.date ? new Date(item.date).toLocaleDateString('en-UK') : '',
                hoursWorked: actualHours,
                shiftTimes: {
                    startTime: getDateFromMaybeMongo(item?.start_trip_checklist?.time_and_date)?.toISOString() || null,
                    endTime: getDateFromMaybeMongo(item?.end_trip_checklist?.time_and_date)?.toISOString() || null,
                    oneHourBreak: !!item?.end_trip_checklist?.one_hour_break,
                    actualHours,
                },
            };
        });
    };

    const filterAndSetInvoices = (data) => {
        const filtered = data.filter(item => {
            const v = (item[searchColumn] ?? '').toString().toLowerCase();
            const matchesSearch = v.includes((searchQuery || '').toLowerCase());
            const matchesRole = selectedRole === "" || item.role === selectedRole;
            return matchesSearch && matchesRole;
        });
        setFilteredInvoices(filtered);
    };

    const Row = ({ index, style }) => {
        const item = filteredInvoices[index];
        const actualHours = item?.shiftTimes?.actualHours ?? 0;
        const expectedHours = 9;
        const defaultComment = item?.hoursWorked;

        const [localEditing, setLocalEditing] = useState(false);
        const [localComment, setLocalComment] = useState(defaultComment);

        const saveComment = async () => {
          const updatedInvoices = invoice.map(inv =>
              inv._id === item._id ? { ...inv, comments: localComment } : inv
          );
          const updatedFiltered = filteredInvoices.map(inv =>
              inv._id === item._id ? { ...inv, comments: localComment } : inv
          );

          setInvoice(updatedInvoices);
          setFilteredInvoices(updatedFiltered);
          // Intentionally not persisting comments to backend (no endpoint specified for appData comments)
          setLocalEditing(false);
        };

        return (
            <div style={{ ...style, display: 'flex', alignItems: 'center', padding: '5px' }}>
            <div className="flex w-full">
              <div className="flex justify-center items-center p-3 text-center w-8 max-w-8 text-sm border-b border-gray-300">
                  {index + 1}
              </div>
              {Object.values(displayColumns).map((col, i) => {
                if (col === "additionalService") {
                  return (
                    <div key={item._id} className="flex-1 flex items-center justify-center p-3 text-center min-w-32 text-sm border-b border-gray-300">
                      -
                    </div>
                  );
                } else if (col === "comments") {
                  return (
                            <div key={item._id} className="flex-1 flex items-center justify-between p-3 text-center min-w-32 text-sm border-b border-gray-300">
                                {localEditing ? (
                                    <>
                                        <input
                                            value={localComment}
                                            onChange={(e) => setLocalComment(e.target.value)}
                                            className="dark:bg-dark-3 bg-white rounded-md border-[1.5px] border-neutral-300 px-4 py-2.5 outline-none focus:border-primary-200 dark:border-dark-5 disabled:border-gray-200 disabled:text-gray-500 flex-1"
                                        />
                                        <button className="ml-4 text-blue-600" onClick={saveComment}>Save</button>
                                    </>
                                ) : (
                                    <>
                                        <span className={`flex-1`}>
                                            {localComment}
                                        </span>
                                        {actualHours > expectedHours && (
                                            <button className="ml-4 text-white-500 bg-neutral-300 px-2 py-0.5 rounded" onClick={() => setLocalEditing(true)}>
                                                Edit
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                }
                else if (col === 'date') {
                    return (
                    <div key={item._id} className="flex-1 flex items-center justify-center p-3 text-center min-w-32 text-sm border-b border-gray-300">
                      {item[col]}
                    </div>
                  );
                }
                else {
                  return (
                    <div key={item._id} className="flex-1 flex items-center justify-center p-3 text-center min-w-32 text-sm border-b border-gray-300">
                      {item[col]}
                    </div>
                  );
                }
              })}
              </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full flex flex-col p-3.5">
            {toastOpen && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded shadow border border-gray-300 z-50">{toastOpen.content}</div>}
            <h2 className="text-xl font-bold mb-3">Working Hours</h2>

            <div className={`grid grid-cols-3 p-3 gap-2 md:gap-5 bg-neutral-100/90 dark:bg-dark-2 shadow border-[1.5px] border-neutral-300/80 dark:border-dark-5 rounded-lg overflow-visible dark:!text-white mb-3`}>
                <div className='flex flex-col gap-1'>
                    <label className="text-xs font-semibold">Select Role:</label>
                    <select
                        className="dark:bg-dark-3 bg-white rounded-md border-[1.5px] border-neutral-300 px-12 py-3.5 outline-none focus:border-primary-200 dark:border-dark-5 disabled:border-gray-200 disabled:text-gray-500"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                    >
                        <option value="">All Roles</option>
                        {roles.map((role) => (
                            <option key={role.roleName} value={role.roleName}>
                                {role.roleName}
                            </option>
                        ))}
                    </select>
                </div>
                    <div className={rangeType === "weekly" ? "flex flex-col gap-1" : "hidden"}>
                        <label className='text-xs font-semibold'>Select Week:</label>
                        <WeekInput
                            value={selectedWeek}
                            onChange={(week) => {
                                setSelectedWeek(week)
                            }}
                        />
                    </div>
                {   rangeType == "daily" &&
                    <div className='flex flex-col gap-1'>
                        <label className='text-xs font-semibold'>Select Date:</label>
                        <DatePickerLocal iconPosition={'left'} value={selectedDate}
                            onChange={(date) => {
                                setSelectedDate(date);
                            }} />
                    </div>
                }
                <div className='flex flex-col gap-1'>
                    <label className='text-xs font-semibold'>Timeframe: </label>
                    <select className="bg-white rounded-md border-[1.5px] border-neutral-300  px-12 py-3.5 outline-none focus:border-primary-200 dark:bg-dark-3 dark:border-dark-5" value={rangeType} onChange={(e) => {setRangeType(e.target.value)}}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 flex flex-col w-full h-full bg-white rounded-lg border border-neutral-200 overflow-hidden">
                <div className="z-15 sticky top-0 flex items-center justify-between bg-white backdrop-blur-md p-2 rounded-t-lg border-b border-neutral-200">
                    <div className="text-sm md:text-base">Working Hours Logs</div>
                    <TableFeatures
                        repopulate={repopulate}
                        setRepopulate={setRepopulate}
                        columns={columns}
                        setColumns={setDisplayColumns}
                        content={filteredInvoices}
                        setContent={setFilteredInvoices}
                    />
                </div>
                { filteredInvoices.length == 0 && 
                  <h2 className="flex justify-center p-5">No Data</h2>
                }
                { filteredInvoices.length > 0 && 
                  <div className="flex-1 flex flex-col h-full w-full">
                      <div className="flex w-full text-sm md:text-base sticky top-0 bg-white z-8 text-gray-400 border-b border-gray-300">
                          <div className="font-light py-2 px-0 text-center w-8 max-w-8">#</div>
                          {Object.keys(displayColumns).map((col) => (
                              <div key={col} className="flex-1 font-light py-2 px-0 text-center min-w-32">{col}</div>
                          ))}
                      </div>
                      <div className="rounded-md flex-1 h-full  w-full">
                          <AutoSizer>
                              {({ width, height }) => (
                                  <FixedSizeList
                                      height={height}
                                      width={width}
                                      itemCount={filteredInvoices.length}
                                      itemSize={75}
                                  >
                                      {Row}
                                  </FixedSizeList>
                              )}
                          </AutoSizer>
                      </div>
                  </div>
                }
            </div>
        </div>
    );
};

export default WorkingHours;