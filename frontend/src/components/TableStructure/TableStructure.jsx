import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom'; // Add this import
import { useSelector, useDispatch } from 'react-redux';
import TableFilters from '../TableFilters/TableFilters';
import { fetchPersonnels } from '../../features/personnels/personnelSlice';
import moment from 'moment';
import { MultiGrid, AutoSizer } from "react-virtualized";
import "react-virtualized/styles.css";
import { FcApproval, FcClock, FcTodoList, FcHighPriority, FcCheckmark } from "react-icons/fc";
import { FaChevronLeft, FaChevronRight, FaEye } from "react-icons/fa";
import { BsCheckCircleFill } from "react-icons/bs";
import { FaCloudDownloadAlt } from "react-icons/fa";

const TableStructure = ({ title, state, setters, tableData, invoiceMap, handleFileChange, selectedInvoices, handleSelectAll, updateInvoiceApprovalStatus, visionIds, setVisionIds, visionTracker, setVisionTracker, manageSummaryLoading, onDownloadDayCSV, ScheduleStatus }) => {
    const dispatch = useDispatch();
    const gridRef = useRef(null);
    const { personnelStatus } = useSelector((state) => state.personnels);
    const personnelsByRole = useSelector((state) => state.personnels.byRole);
    const [isFilterOpen, setIsFilterOpen] = useState(true);
    const [scroll, setScroll] = useState({ row: 0, col: 0 });
    const { userDetails } = useSelector((state) => state.auth);

    const { rangeType, rangeOptions, selectedRangeIndex, days, selectedSite, selectedRole, searchPersonnel, personnelsList } = state;
    const { setRangeType, setRangeOptions, setSelectedRangeIndex, setDays, setSelectedSite, setSelectedRole, setSearchPersonnel, setPersonnelsList } = setters;

    const getPersonnelSiteForDate = (personnel, date) => {
        const traces = personnel?.siteTrace || [];
        if (traces.length === 0) {
            return personnel?.siteSelection;
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

    useEffect(() => {
        if (personnelStatus === 'idle') dispatch(fetchPersonnels());
    }, [personnelStatus, dispatch]);

    useEffect(() => {
        if (Object.keys(personnelsByRole).length > 0) {
            const startDate = new Date(days[0]?.date.split(',')[1]);
            const endDate = new Date(days[days.length - 1]?.date.split(',')[1]);

            const getPersonnelSiteForRange = (personnel, startDate, endDate) => {
                const traces = personnel?.siteTrace || [];
                if (traces.length === 0) {
                    return personnel?.siteSelection;
                }

                const sortedTraces = traces
                    .slice()
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                let latestSite = personnel.siteSelection;
                const relevantSites = new Set();

                for (const trace of sortedTraces) {
                    const changeDate = new Date(trace.timestamp).setHours(0, 0, 0, 0);
                    const startDateTime = startDate.setHours(0, 0, 0, 0);
                    const endDateTime = endDate.setHours(0, 0, 0, 0);

                    if (changeDate <= endDateTime) {
                        if (changeDate === startDateTime) {
                            relevantSites.add(trace.to);
                        } else if (changeDate > startDateTime && changeDate <= endDateTime) {
                            relevantSites.add(trace.from);
                            relevantSites.add(trace.to);
                        } else if (changeDate < startDateTime) {
                            latestSite = trace.to;
                        }
                    }
                }

                if (relevantSites.size === 0 && sortedTraces.length > 0) {
                    const firstTrace = sortedTraces[0];
                    if (endDate.getTime() < new Date(firstTrace.timestamp)) {
                        return firstTrace.from;
                    }
                    return latestSite;
                }

                return relevantSites.size > 0 ? Array.from(relevantSites) : latestSite;
            };

            // Modified: Return all site changes within the date range
            const getSiteChangeDetails = (personnel, startDate, endDate) => {
                const traces = personnel?.siteTrace || [];
                if (traces.length === 0) return [];

                const sortedTraces = traces
                    .slice()
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const startDateTime = startDate.setHours(0, 0, 0, 0);
                const endDateTime = endDate.setHours(0, 0, 0, 0);

                const siteChanges = sortedTraces
                    .filter((trace) => {
                        const changeDate = new Date(trace.timestamp).setHours(0, 0, 0, 0);
                        return changeDate >= startDateTime && changeDate <= endDateTime;
                    })
                    .map((trace) => ({
                        fromSite: trace.from,
                        toSite: trace.to,
                        changeDate: moment(trace.timestamp).format('DD/MM/YYYY'),
                    }));

                return siteChanges;
            };

        //    // Filter personnels based on siteTrace and disabled status
        //    let personnelsList = Object.values(personnelsByRole).flat().filter((personnel) => {
        //        if (personnel.disabled) return false;
        //        if (userDetails.role == 'Operational Manager') {
        //            if (
        //                  !(
        //                    Array.isArray(personnel.siteSelection) &&
        //                    Array.isArray(userDetails?.siteSelection) &&
        //                    personnel.siteSelection.some(s => userDetails.siteSelection.includes(s))
        //                  )
        //                ) return false;
        //        }
        //        const personnelSite = getPersonnelSiteForRange(personnel, startDate, endDate);
        //        return Array.isArray(personnelSite)
        //            ? personnelSite.includes(selectedSite)
        //            : personnelSite === selectedSite;
        //    });
//
        //    // Combine personnelsList and standbypersonnelsList
        //    const combinedPersonnelsList = [
        //        ...personnelsList.map((personnel) => {
        //            const siteChanges = getSiteChangeDetails(personnel, startDate, endDate);
        //            return {
        //                ...personnel,
        //                siteChanges: siteChanges.length > 0 ? siteChanges : null,
        //            };
        //        })
        //    ];
//
        //    setPersonnelsList(personnelsList);

            // Start from all non-disabled personnels
            const all = Object.values(personnelsByRole).flat().filter(p => !p.disabled);

            // If not OM, or no site is selected yet, do not site-filter here.
            if (userDetails.role !== 'Operational Manager' || !selectedSite || !days?.length) {
                const byRole = selectedRole
                    ? (personnelsByRole[selectedRole] || []).filter(p => !p.disabled)
                    : all;
                setPersonnelsList(byRole);
                return;
            }

            // OM: restrict to personnels sharing at least one site with the OM, then
            // match the selectedSite across the visible date range (accounts for siteTrace).
            const OSMs = all.filter(p => p.role == 'On-Site Manager');
            const bySite = OSMs.filter((personnel) => {
                if (
                    !(
                        Array.isArray(personnel.siteSelection) &&
                        Array.isArray(userDetails?.siteSelection) &&
                        personnel.siteSelection.some(s => userDetails.siteSelection.includes(s))
                    )
                ) return false;
                const personnelSite = getPersonnelSiteForRange(personnel, startDate, endDate);
                return Array.isArray(personnelSite)
                    ? personnelSite.includes(selectedSite)
                    : personnelSite === selectedSite;
            });

            setPersonnelsList(bySite);
        }
    }, [personnelsByRole, selectedSite, days]);

    useEffect(() => {
        if (!invoiceMap || Object.keys(invoiceMap).length === 0) return;

        setVisionIds(
            Object.values(invoiceMap).filter(
                (inv) => inv?.invoice?.approvalStatus === visionTracker?.invoice?.approvalStatus &&
                    inv?.invoice?.site === selectedSite &&
                    (searchPersonnel !== '' ? String(inv?.invoice?.personnelName).toLocaleLowerCase().includes(searchPersonnel.toLowerCase()) : true)
            )
        );
        setVisionTracker(
            Object.values(invoiceMap).filter(
                (inv) => inv?.invoice?.approvalStatus === visionTracker?.invoice?.approvalStatus &&
                    inv?.invoice?.site === selectedSite &&
                    (searchPersonnel !== '' ? String(inv?.invoice?.personnelName).toLocaleLowerCase().includes(searchPersonnel.toLowerCase()) : true)
            )[0] || null
        );
    }, [searchPersonnel]);

    const GridComponent = () => {
        const rowCount = searchPersonnel !== ''
            ? personnelsList.filter((personnel) =>
                String(personnel.firstName + ' ' + personnel.lastName)
                    .toLowerCase()
                    .includes(searchPersonnel.toLowerCase())
            ).length + 1
            : personnelsList.length + 1;
        const columnCount = days?.length + 1;
        const topLeftRowHeight = 50;
        const defaultRowHeight = 120;

        const getRowHeight = ({ index }) => {
            if (index === 0) {
                return topLeftRowHeight;
            }
            return defaultRowHeight;
        };

        const cellRenderer = ({ columnIndex, rowIndex, key, style }) => {
            const isHeader = rowIndex === 0;
            const isFirstCol = columnIndex === 0;
            const isTopLeft = isHeader && isFirstCol;
            const personnel = searchPersonnel !== ''
                ? personnelsList.filter((personnel) =>
                    String(personnel.firstName + ' ' + personnel.lastName)
                        .toLowerCase()
                        .includes(searchPersonnel.toLowerCase())
                )[rowIndex - 1]
                : personnelsList[rowIndex - 1];
            const day = days[columnIndex - 1];

            const dayOfChange = personnel?.siteChanges?.some(change =>
                moment(change.changeDate, 'DD/MM/YYYY').isSame(moment(day?.date), 'day')
            ) || false;

            const disabledPersonnel = personnel?.activeStatus !== 'Active' ? personnel?.activeStatus : null;
            const isToday = day && new Date(day.date).toDateString() === new Date().toDateString();

            let classNames = `flex items-center justify-center border-[0.5px] border-gray-300 ${dayOfChange && !isFirstCol && '!border-l-3 border-dashed border-l-blue-500'} text-sm p-4 h-full `;

            if (isTopLeft) {
                classNames += ' bg-primary-300 text-white font-bold';
            } else if (isHeader) {
                classNames += ' bg-primary-300 text-white font-light ';
            } else if (isFirstCol) {
                classNames += ` font-medium p-4 `;
            } else {
                classNames += ` bg-white ${isToday ? '!bg-amber-100/20 relative' : 'relative'}`;
            }

            return (
                <div key={key} className={classNames} style={style}>
                    {isTopLeft ? (
                        'Personnels List'
                    ) : isHeader ? (
                        <div className="flex flex-col gap-1 items-center p-2">
                            <div className="flex items-center gap-2">
                                <span>{day?.date}</span>
                                {title === 'Schedule Planner' && typeof onDownloadDayCSV === 'function' && (
                                    <FaCloudDownloadAlt
                                        size={18}
                                        className="text-white/90 hover:text-white cursor-pointer"
                                        title="Download CSV"
                                        onClick={() => onDownloadDayCSV(day)}
                                    />
                                )}
                            </div>
                            {(rangeType === 'biweekly' || rangeType === 'monthly') && (
                                <div className="font-medium text-gray-600 w-fit px-1 py-0.5 text-[0.55rem] bg-stone-100 rounded-sm">
                                    {day?.week}
                                </div>
                            )}
                        </div>
                    ) : searchPersonnel !== '' ? (
                        String(personnel.firstName + ' ' + personnel.lastName).toLowerCase().includes(searchPersonnel.toLowerCase()) ? (
                            isFirstCol ? (
                                <div className="flex justify-center flex-col gap-1 h-full w-full">
                                    <p>{personnel.firstName + ' ' + personnel.lastName}</p>
                                    {title === 'Manage Summary' &&
                                        personnel.transporterName &&
                                        personnel.firstName + ' ' + personnel.lastName !== personnel.transporterName && (
                                            <p className="text-normal text-xs">({personnel.transporterName})</p>
                                        )}
                                    <div className="flex flex-col justify-left gap-1">
                                        {disabledPersonnel && (
                                            <div className="text-xs text-center text-stone-600 bg-stone-400/40 shadow-sm border-[1.5px] border-stone-400/10 p-0.5 rounded-sm w-fit">
                                                {disabledPersonnel}
                                            </div>
                                        )}
                                        {personnel.siteChanges && (
                                            <div className="bg-blue-100 text-blue-700 rounded-md p-2 text-xs w-60 shadow w-fit">
                                                <div className="flex gap-4 items-center">
                                                    <i className="flex items-center fi fi-sr-replace"></i>
                                                    <span>Site Changed</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                tableData(personnel, day, disabledPersonnel)
                            )
                        ) : null
                    ) : isFirstCol ? (
                        <div className="flex justify-center flex-col gap-1 h-full w-full">
                            <p>{personnel.firstName + ' ' + personnel.lastName}</p>
                            {title === 'Manage Summary' &&
                                personnel.transporterName &&
                                personnel.firstName + ' ' + personnel.lastName !== personnel.transporterName && (
                                    <p className="text-normal text-xs">({personnel.transporterName})</p>
                                )}
                            <div className="flex flex-col justify-left gap-1">
                                {disabledPersonnel && (
                                    <div className="text-xs text-center text-stone-600 bg-stone-400/40 shadow-sm border-[1.5px] border-stone-400/10 p-0.5 rounded-sm w-fit">
                                        {disabledPersonnel}
                                    </div>
                                )}
                                {personnel.siteChanges && (
                                    <div className="bg-blue-100 text-blue-700 rounded-md p-2 text-xs w-60  shadow w-fit">
                                        <div className="flex gap-4 items-center">
                                            <i className="flex items-center fi fi-sr-replace"></i>
                                            <span>Site Changed</span>
                                        </div>
                                    </div>

                                )}
                            </div>
                        </div>
                    ) : (
                        tableData(personnel, day, disabledPersonnel)
                    )}
                </div>
            );
        };

        return (
            <div className="rounded-md flex-1 h-full overflow-hidden w-full">
                <AutoSizer>
                    {({ width, height }) => {
                        const columnWidth = ({ index }) => {
                            if (rangeType === 'daily') {
                                return Math.floor(width / 2);
                            } else if (rangeType === 'weekly') {
                                return Math.max(200, Math.floor(width / 7));
                            } else if (rangeType === 'biweekly') {
                                return Math.max(200, Math.floor(width / 14));
                            } else {
                                return 200;
                            }
                        };
                        return (
                            <MultiGrid
                                ref={gridRef}
                                key={`${JSON.stringify(visionTracker)}-${selectedSite}-${JSON.stringify(days.map((d) => d.date))}-${JSON.stringify(personnelsList.map((d) => d._id))}-${width}-${height}`}
                                fixedRowCount={1}
                                fixedColumnCount={1}
                                rowCount={rowCount}
                                columnCount={columnCount}
                                rowHeight={getRowHeight}
                                columnWidth={columnWidth}
                                height={height}
                                width={width}
                                cellRenderer={cellRenderer}
                                scrollToRow={scroll?.row + 1}
                                scrollToColumn={scroll?.col + 1}
                                scrollToAlignment={'center'}
                                classNameTopLeftGrid="z-30"
                                classNameTopRightGrid="z-25"
                                classNameBottomLeftGrid="z-20"
                                classNameBottomRightGrid="z-15"
                            />
                        );
                    }}
                </AutoSizer>
            </div>
        );
    };

    const handleNavigation = (direction) => {
        const currentIndex = visionIds.findIndex(
            (item) => item.invoice._id === visionTracker?.invoice._id
        );

        let newIndex;
        if (direction === 'previous') {
            newIndex = currentIndex <= 0 ? visionIds.length - 1 : currentIndex - 1;
        } else {
            newIndex = currentIndex >= visionIds.length - 1 ? 0 : currentIndex + 1;
        }
        setVisionTracker(visionIds[newIndex]);
    };

    useEffect(() => {
        if (visionTracker) {
            setScroll({
                row: personnelsList.filter((personnel) =>
                    searchPersonnel !== ''
                        ? String(personnel.firstName + ' ' + personnel.lastName)
                            .toLowerCase()
                            .includes(searchPersonnel.toLowerCase())
                        : true
                ).findIndex((personnel) => personnel._id === visionTracker?.invoice?.personnelId),
                col: moment(visionTracker?.invoice?.date).day(),
            });
        } else {
            setScroll({ row: 0, col: 0 });
        }
    }, [visionTracker]);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-1.5 md:p-3 overflow-hidden dark:text-white">
            <div className="flex flex-col w-full h-full bg-white dark:bg-dark-3 rounded-3xl shadow overflow-hidden">
                <div className="flex font-bold text-lg justify-between items-center z-5 rounded-t-lg w-full px-2 py-2 bg-white dark:bg-dark dark:border-dark-3 border-b border-neutral-200 dark:text-white">
                    <h3 className='md:ml-3'>{title}</h3>
                    <button
                        onClick={() => setIsFilterOpen((prev) => !prev)}
                        className={`rounded-3xl p-2 hover:bg-gray-200 hover:text-primary-500 ${isFilterOpen && 'bg-gray-200 text-primary-500'}`}
                    >
                        <i className="flex items-center text-[1rem] fi fi-rr-filter-list"></i>
                    </button>
                </div>
                <div className="flex-1 flex flex-col h-full p-2">
                    <div className={`transition-all duration-300 ease-in-out ${isFilterOpen ? 'max-h-40 pb-2 opacity-100 visibility-visible' : 'max-h-0 opacity-0 visibility-hidden'}`}>
                        <TableFilters
                            title={title}
                            state={state}
                            setters={setters}
                            manageSummaryLoading={manageSummaryLoading}
                            invoiceMap={invoiceMap}
                            handleFileChange={handleFileChange}
                            selectedInvoices={selectedInvoices}
                            handleSelectAll={handleSelectAll}
                            updateInvoiceApprovalStatus={updateInvoiceApprovalStatus}
                        />
                    </div>
                    {title === 'Schedule Planner' && <ScheduleStatus />}
                    {GridComponent()}
                </div>
            </div>
        </div>
    );
};

export default TableStructure;