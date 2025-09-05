import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchSites } from '../../../features/sites/siteSlice';
import { fetchRoles } from '../../../features/roles/roleSlice';
import moment from 'moment';
import { FaChevronLeft, FaChevronRight, FaPoundSign } from 'react-icons/fa';
import Flatpickr from 'react-flatpickr';
import monthSelectPlugin from "flatpickr/dist/plugins/monthSelect";
import "flatpickr/dist/plugins/monthSelect/style.css";
import { fetchPersonnels } from '../../../features/personnels/personnelSlice';
import axios from 'axios';
import Modal from '../../../components/Modal/Modal';
import { jsPDF } from "jspdf";
import InputWrapper from '../../../components/InputGroup/InputWrapper';
import InputGroup from '../../../components/InputGroup/InputGroup';
import { PrintableContent } from './PrintContent';
import { PDFDocument } from "pdf-lib";
import ReactDOMServer from 'react-dom/server';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import SuccessTick from '../../../components/UIElements/SuccessTick';
import { FcApproval, FcClock, FcTodoList, FcHighPriority, FcCheckmark } from "react-icons/fc";
import { BsCheckCircleFill } from "react-icons/bs";
import WeekFilter from '../../../components/Calendar/WeekFilter'

const API_BASE_URL = import.meta.env.VITE_API_URL;

moment.updateLocale('en', {
    week: {
        dow: 0,
    },
});

const stageIcons = {
    "Access Requested": <FcHighPriority size={18} />,
    "Under Edit": <i class="flex items-center text-amber-500 fi fi-rr-pen-square text-base"></i>,
    "Under Approval": <i class="flex items-center text-sky-500 fi fi-rs-memo-circle-check text-base"></i>,
    "Invoice Generation": <FcClock className='!text-primary-500' size={18} />,
    "completed": <BsCheckCircleFill className="text-green-600 text-base" />
};

const WeeklyInvoice = () => {
    const dispatch = useDispatch();
    const stopSendingRef = useRef(false);
    const stopDownloadingRef = useRef(false);
    const [isFilterOpen, setIsFilterOpen] = useState(true);
    const [sendingInvoice, setSendingInvoice] = useState(null);
    const [downloadingInvoice, setDownloadingInvoice] = useState(null);
    const [selectedInvoices, setSelectedInvoices] = useState([]);
    const [sentCount, setSentCount] = useState(0);
    const [downloadCount, setDownloadCount] = useState(0);

    const { userDetails } = useSelector((state) => state.auth);
    const { list: sites, siteStatus } = useSelector((state) => state.sites);
    const { list: roles, roleStatus } = useSelector((state) => state.roles);
    const { byRole: personnelsByRole, personnelStatus } = useSelector((state) => state.personnels);

    const [selectedVehicleType, setSelectedVehicleType] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [searchPersonnel, setSearchPersonnel] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(moment().startOf('month').toDate());
    const [weeks, setWeeks] = useState([]);
    const [personnelsList, setPersonnelsList] = useState([]);
    const [standbypersonnelsList, setStandbypersonnelsList] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [groupedInvoices, setGroupedInvoices] = useState([]);
    const [currentInvoice, setCurrentInvoice] = useState(null);
    const [sendingOneInvoice, setSendingOneInvoice] = useState(false);
    const [changed, setChanged] = useState(false);
    const [toastOpen, setToastOpen] = useState(null)

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    useEffect(() => {
        if (siteStatus === 'idle') dispatch(fetchSites());
        if (roleStatus === 'idle') dispatch(fetchRoles());
        if (personnelStatus === 'idle') dispatch(fetchPersonnels());
    }, [siteStatus, personnelStatus, roleStatus, dispatch]);

    useEffect(() => {
        setSelectedInvoices([])
    }, [])

    useEffect(() => {
        const fetchInvoices = async () => {
            if (personnelsList.length > 0 && weeks.length > 0) {
                const serviceWeeks = weeks.map((week) => week.week);
                const response = await axios.get(`${API_BASE_URL}/api/weeklyInvoice`, {
                    params: {
                        personnelIds: personnelsList.map((personnel) => personnel._id),
                        serviceWeeks: serviceWeeks,
                    }
                });
                setInvoices(response.data.data);
            }
        };
        fetchInvoices();
    }, [personnelsList, weeks]);


    useEffect(() => {
        let map = {};
        invoices?.filter((inv) => {
            if (searchPersonnel !== '') {
                return String(inv.personnelId.firstName + ' ' + inv.personnelId.lastName)
                    .toLowerCase()
                    .includes(searchPersonnel.toLowerCase())

            }
            if (selectedVehicleType !== '') {
                return inv.personnelId.typeOfPersonnel === selectedVehicleType
            }
            else
                return true
        }).forEach(inv => {
            let allCompleted = !inv.invoices.some((inv) => inv.approvalStatus !== 'completed');
            const key = `${inv.personnelId._id}_${inv.serviceWeek}`;
            map[key] = { ...inv, allCompleted};
        });
        setGroupedInvoices(map);
    }, [invoices, searchPersonnel, selectedVehicleType]);

    useEffect(() => {
        const startOfMonth = moment(selectedMonth, 'YYYY-MM').startOf('month');
        const endOfMonth = moment(selectedMonth, 'YYYY-MM').endOf('month');
        const weeksArray = [];
        let currentWeek = startOfMonth.clone().startOf('week');
        while (currentWeek.isSameOrBefore(endOfMonth, 'week')) {
            weeksArray.push({
                week: currentWeek.format('YYYY-[W]ww'),
                start: currentWeek.clone().startOf('week'),
                end: currentWeek.clone().endOf('week'),
            });
            currentWeek.add(1, 'week');
        }
        setWeeks(weeksArray);
    }, [selectedMonth]);

    useEffect(() => {
        if (Object.keys(personnelsByRole).length > 0) {
            let personnelsList = selectedRole === ''
                ? Object.values(personnelsByRole).flat()
                : (personnelsByRole[selectedRole] || []);
            setPersonnelsList(personnelsList.filter(p => !p.disabled));
        }
    }, [personnelsByRole, selectedRole]);

    const handleMonthChange = (direction) => {
        const newMonth = moment(selectedMonth)
            .add(direction === 'next' ? 1 : -1, 'month')
            .toDate();
        setSelectedMonth(newMonth);
    };

    useEffect(() => {
        return () => {
            // Cleanup on component unmount
            stopSendingRef.current = true; // Stop the sending process
            stopDownloadingRef.current = true
        };
    }, []);

    const mergePDFs = async (generatedPdfBytes, additionalPdfUrls) => {
        const pdfDoc = await PDFDocument.load(generatedPdfBytes);
        for (const pdfUrl of additionalPdfUrls) {
            if (pdfUrl) {
                try {
                    const response = await fetch(pdfUrl);
                    const pdfBytes = await response.arrayBuffer();
                    const pdfToMerge = await PDFDocument.load(pdfBytes);
                    const copiedPages = await pdfDoc.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
                    copiedPages.forEach((page) => pdfDoc.addPage(page));
                } catch (error) {
                    console.error("Error merging PDF:", pdfUrl, error);
                }
            }
        }
        return await pdfDoc.save();
    };

    const generatePDF = async (invoice, actionType) => {
        const tempDiv = document.createElement("div");
        tempDiv.style.width = "794px";
        tempDiv.style.height = "1123px";
        tempDiv.style.minWidth = "794px";
        tempDiv.style.minHeight = "1123px";
        tempDiv.style.maxWidth = "794px";
        tempDiv.style.maxHeight = "1123px";
        // document.body.appendChild(tempDiv);

        const printableContent = ReactDOMServer.renderToStaticMarkup(
            <PrintableContent invoice={invoice} personnelDetails={invoice.personnelId} sites={sites} />
        );

        tempDiv.innerHTML = printableContent;

        // const clone = document.createElement("div");
        // clone.innerHTML = printableContent;
        // tempDiv.appendChild(clone);

        const doc = new jsPDF('portrait', 'mm', 'a4');
        const installmentPdfs = invoice.installments?.map((id) => id.installmentDocument) || [];
        const deductionPdfs = invoice.invoices.flatMap((inv) => inv.deductionDetail?.map((d) => d.deductionDocument) || []);

        return new Promise((resolve, reject) => {
            doc.html(tempDiv, {
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 0.262,
                    useCORS: true,
                    logging: true,
                    allowTaint: false,
                },
                callback: async function (doc) {
                    // document.body.removeChild(tempDiv);
                    const pdfBlob = doc.output('blob');
                    const generatedPdfBytes = await pdfBlob.arrayBuffer();
                    const filename = `${invoice.personnelId.firstName} ${invoice.personnelId.lastName}.pdf`;

                    const mergedPdfBytes = await mergePDFs(generatedPdfBytes, [...installmentPdfs, ...deductionPdfs]);
                    const mergedPdfBlob = new Blob([mergedPdfBytes], { type: "application/pdf" });

                    if (actionType === 'print') {
                        const pdfUrl = URL.createObjectURL(mergedPdfBlob);
                        window.open(pdfUrl);
                        resolve();
                        return;
                    }

                    if (actionType === 'downloadAllInvoices') {
                        resolve(mergedPdfBlob);
                        return;
                    }

                    const formData = new FormData();
                    const actionMap = {
                        downloadAllInvoices: 'downloadInvoice',
                        sendAllInvoices: 'sentInvoice',
                    };
                    formData.append('weeklyInvoiceId', invoice._id);
                    formData.append('personnelId', invoice.personnelId._id);
                    formData.append('user_ID', invoice.personnelId.user_ID);
                    formData.append('serviceWeek', invoice.serviceWeek);
                    formData.append('personnelEmail', invoice.personnelId.Email);
                    formData.append('personnelName', invoice.personnelId.firstName + ' ' + invoice.personnelId.lastName);
                    formData.append('actionType', actionMap[actionType] || actionType);
                    formData.append('document', new File([mergedPdfBlob], filename, { type: 'application/pdf' }));

                    try {
                        const res = await axios.put(`${API_BASE_URL}/api/weeklyInvoice/document`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });

                        if (actionType === 'downloadInvoice' || actionType === 'downloadAllInvoices') {
                            const url = window.URL.createObjectURL(mergedPdfBlob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = filename;
                            link.click();
                            URL.revokeObjectURL(url);
                        }

                        if (actionType !== 'downloadAllInvoices' && actionType !== 'sendAllInvoices' && currentInvoice) {
                            setCurrentInvoice(cinvoice => ({ ...cinvoice, invoice: { ...res.data.updatedWeeklyInvoice, allCompleted: cinvoice.invoice?.allCompleted } }));
                        }

                        setInvoices(allinvoices => allinvoices.map((inv) => {
                            if (inv.personnelId._id === invoice.personnelId._id && inv.serviceWeek === invoice.serviceWeek) {
                                return res.data.updatedWeeklyInvoice;
                            }
                            return inv;
                        }));

                        resolve(res.data.updatedWeeklyInvoice);
                        // tempDiv.remove();
                    } catch (err) {
                        console.error("Upload failed:", err);
                        alert("Error processing invoice for " + filename);
                        reject(err);
                    }
                }
            });
        });
    };

    const handleShowDetails = async (invoice) => {
        setCurrentInvoice({ invoice });
    };

    const handleUpdateInvoice = async (currentInvoice) => {
        try {
            const res = await axios.put(`${API_BASE_URL}/api/weeklyInvoice/update`, {
                weeklyInvoiceId: currentInvoice.invoice._id,
                installmentDetail: currentInvoice.invoice.installmentDetail,
                weeklyTotal: currentInvoice.invoice.total,
                instalments: currentInvoice.instalments
            });
            setChanged(false);
            setCurrentInvoice(cinvoice => ({ ...cinvoice, invoice: { ...res.data.weeklyInvoice, allCompleted: cinvoice.invoice?.allCompleted } }));
            setInvoices(allinvoices => allinvoices.map((inv) => {
                if (inv.personnelId._id === currentInvoice?.invoice?.personnelId?._id && inv.serviceWeek === currentInvoice?.invoice?.serviceWeek)
                    return res.data.weeklyInvoice;
                return inv;
            }));
        } catch (err) {
            console.error("Upload failed:", err);
            alert("Error uploading invoice.");
        }
    };

    const LastSentTime = ({ sentInvoice }) => {
        let displayTime;
        const [, setTick] = useState(0); // used to trigger re-render every 60s

        if (sentInvoice?.length > 0) {
            const latestSent = [...sentInvoice].sort(
                (a, b) => new Date(b.date) - new Date(a.date)
            )[0];
            displayTime = latestSent.date;
        }

        useEffect(() => {
            if (!displayTime) return;

            const interval = setInterval(() => {
                setTick(tick => tick + 1);
            }, 60000);

            return () => clearInterval(interval);
        }, []);

        if (!displayTime) return null;

        return (
            <div className="bg-purple-300/50 rounded-full px-1.5 py-0.5 text-purple-700 text-[0.7rem]">
                last sent {moment(displayTime).fromNow()}
            </div>
        );
    };

    const tableData = (personnel) => {
        return weeks.map((week) => {
            const key = `${personnel._id}_${week.week}`;
            const invoice = groupedInvoices[key];
            const isToday = moment(week.week, 'YYYY-[W]ww').isSame(moment(), 'week');
            const cellClass = isToday ? 'bg-amber-100/20' : '';
            return (
                <td key={week.week} className={cellClass}>
                    {invoice && (
                        <div className="relative flex justify-center h-full w-full">
                            <div className={`${(sendingInvoice === invoice._id || downloadingInvoice === invoice._id) && 'card '} p-0.5 relative w-full flex justify-center items-center `}>
                                <div
                                    onClick={(e) => {
                                        if (sendingInvoice || downloadingInvoice) return;
                                        if (e.metaKey || e.ctrlKey) {
                                            setSelectedInvoices(
                                                selectedInvoices.includes(key)
                                                    ? selectedInvoices.filter(k => k !== key)
                                                    : [...selectedInvoices, key]
                                            );
                                        } else if (selectedInvoices.some((k) => k === key)) {
                                            setSelectedInvoices(
                                                selectedInvoices.filter(k => k !== key)
                                            );
                                        } else {
                                            handleShowDetails(invoice);
                                        }
                                    }}
                                    className={`cursor-pointer relative z-6 w-full h-full flex flex-col justify-center gap-1 items-center overflow-auto dark:bg-dark-4 dark:text-white w-full bg-gray-100 border 
                                    ${selectedInvoices.includes(key) && sendingInvoice !== invoice._id && downloadingInvoice !== invoice._id
                                            ? 'border-[1.5px] border-primary-500' : 'border-gray-300 dark:border-dark-5'} rounded-md text-sm p-2 `}
                                >
                                    <div className="grid grid-cols-[6fr_1fr] w-full">
                                        <strong className="text-xs">Total Invoice count:</strong>
                                        <div className="text-xs overflow-auto max-h-[4rem] w-full text-center">{invoice?.count}</div>
                                        <strong className="text-xs">Completed:</strong>
                                        <div className="overflow-auto max-h-[4rem] w-full text-center">{invoice.invoices.filter((inv) => inv.approvalStatus === 'completed').length}</div>
                                    </div>
                                    {invoice.sentInvoice.length > 0 &&
                                        <LastSentTime sentInvoice={invoice.sentInvoice} />
                                    }
                                    {invoice.unsigned ? (
                                        <div className="flex items-center gap-1 text-[0.7rem] bg-yellow-200 text-yellow-800 rounded-full px-1.5 py-0.5">
                                            <i className="flex items-center fi fi-sr-seal-exclamation"></i>unsigned docs
                                        </div>
                                    ) : invoice?.allCompleted ? (
                                        <div className="flex gap-1 text-[0.7rem] bg-sky-200 rounded-full px-1 py-0.5">
                                            <i className="flex items-center fi fi-rr-document"></i>Ready to print
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    )}
                </td>
            );
        });
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-1.5 md:p-3 overflow-hidden dark:text-white rounded-xl">
            <div className="flex flex-col gap-1 w-full h-full bg-white dark:bg-dark-3 rounded-xl shadow overflow-hidden">
                <div className={`${toastOpen ? 'opacity-100 translate-y-16' : 'opacity-0'} transition-all ease-in duration-200 border border-stone-200 fixed flex justify-center items-center z-50 backdrop-blur-sm top-4 left-1/2 -translate-x-1/2 bg-stone-400/20 dark:bg-dark/20 p-3 rounded-lg shadow-lg`}>
                    <div className='flex gap-4 justify-around items-center'>
                        {toastOpen?.content}
                    </div>
                </div>
                <div className='flex font-bold text-lg justify-between items-center z-5 rounded-t-lg w-full px-3 py-1.5 bg-white dark:bg-dark dark:border-dark-3 border-b border-neutral-200 dark:text-white'>
                    <h3>Weekly Invoice</h3>
                    <button onClick={() => setIsFilterOpen(prev => !prev)} className={`rounded-lg p-2 hover:bg-gray-200 hover:text-primary-500 ${isFilterOpen && 'bg-gray-200 text-primary-500'}`}><i class="flex items-center text-[1rem] fi fi-rr-filter-list"></i></button>
                </div >
                <div className='flex flex-col p-2 overflow-auto'>
                    <div className={`transition-all duration-300 ease-in-out ${isFilterOpen ? 'max-h-40 pb-2 opacity-100 visibility-visible' : 'max-h-0 opacity-0 visibility-hidden'}`}>
                        <div className="grid grid-cols-3 md:grid-cols-[1fr_3fr_3fr_3fr_3fr_4fr] p-2 gap-2 md:gap-5 bg-neutral-100/90 dark:bg-dark-2 shadow border-[1.5px] border-neutral-300/80 dark:border-dark-5 rounded-lg overflow-visible dark:!text-white">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold">Invoices sent:</label>
                                <p>{Object.values(groupedInvoices).reduce((acc, ginv) => {
                                    return acc + (ginv.sentInvoice.length > 0 ? 1 : 0);
                                }, 0)}/{Object.values(groupedInvoices).length}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold">Search Personnel Name:</label>
                                <input
                                    disabled={downloadingInvoice || sendingInvoice}
                                    type="text"
                                    onChange={(e) => setSearchPersonnel(e.target.value)}
                                    className="dark:bg-dark-3 bg-white rounded-md border-[1.5px] border-neutral-300 dark:border-dark-5 px-2 py-1 h-8 md:h-10 outline-none focus:border-primary-200"
                                    placeholder="Personnel name"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold">Select Role:</label>
                                <select
                                    disabled={downloadingInvoice || sendingInvoice}
                                    className="dark:bg-dark-3 bg-white rounded-md border-[1.5px] border-neutral-300 px-2 py-1 h-8 md:h-10 outline-none focus:border-primary-200 dark:border-dark-5 disabled:border-gray-200 disabled:text-gray-500"
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
                            <div className="flex flex-col items-center justify-center gap-1">
                                <label className="self-start ml-8 text-xs font-semibold">Select Month:</label>
                                <div className="relative flex items-center justify-center w-full h-full gap-2">
                                    <button
                                        disabled={downloadingInvoice || sendingInvoice}
                                        onClick={() => handleMonthChange('previous')}
                                        className="dark:bg-dark-3 flex justify-center items-center bg-white rounded-md w-7 h-7 shadow-sm border border-neutral-200 dark:border-dark-5"
                                    >
                                        <FaChevronLeft size={13} />
                                    </button>
                                    <WeekFilter value={selectedMonth} type={'monthly'} onChange={(e) => setSelectedMonth(e)} />
                                    <button
                                        disabled={downloadingInvoice || sendingInvoice}
                                        onClick={() => handleMonthChange('next')}
                                        className="dark:bg-dark flex justify-center items-center bg-white rounded-md w-7 h-7 shadow-sm border border-neutral-200 dark:border-dark-5"
                                    >
                                        <FaChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-1 justify-evenly border-[1.5px] border-neutral-300 rounded-md p-2 justify-self-start self-end w-full overflow-auto">
                                <button
                                    disabled={changed || Object.values(groupedInvoices).length === 0 || sendingInvoice || downloadingInvoice || (selectedInvoices.length > 0 ? selectedInvoices.some((invKey) => !groupedInvoices[invKey]?.allCompleted) : Object.values(groupedInvoices).some((ginv) => !ginv?.allCompleted))}
                                    className="flex gap-1 bg-sky-400/50 items-center text-xs text-sky-600 rounded px-2 py-1 disabled:bg-gray-300 disabled:text-white"
                                    onClick={async () => {
                                        try {
                                            setDownloadingInvoice('start');
                                            setDownloadCount(0);
                                            stopDownloadingRef.current = false;

                                            const zip = new JSZip();
                                            const sortedInvoices = Object.values(groupedInvoices).sort((a, b) => {
                                                const nameA = (a.personnelId.firstName + a.personnelId.lastName).toLowerCase();
                                                const nameB = (b.personnelId.firstName + b.personnelId.lastName).toLowerCase();
                                                return nameA.localeCompare(nameB);
                                            });

                                            const total = selectedInvoices.length > 0 ? selectedInvoices.length : Object.values(groupedInvoices).length;
                                            let localDownloadCount = 0;

                                            // Show initial toast
                                            setToastOpen({
                                                content: (
                                                    <div className="w-full text-sm text-gray-800">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                                                            <p className="font-medium">Downloading invoices in progress...</p>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded h-2 mb-1">
                                                            <div className="bg-sky-500 h-2 rounded transition-all duration-300" style={{ width: `0%` }} />
                                                        </div>
                                                        <p className="text-xs text-gray-600 mb-1">Downloaded 0 of {total}</p>
                                                        <p className="text-xs text-red-500 italic">Please do not navigate away — switching pages will stop the process.</p>
                                                    </div>
                                                )
                                            });

                                            for (const invoice of sortedInvoices) {
                                                if (stopDownloadingRef.current) break;

                                                if (selectedInvoices.length > 0) {
                                                    const ids = selectedInvoices.map((si) => groupedInvoices[si]._id);
                                                    if (!ids.includes(invoice._id)) continue;
                                                }

                                                setDownloadingInvoice(invoice._id);

                                                const updatedInvoice = { ...invoice, instalments };
                                                const pdfBlob = await generatePDF(updatedInvoice, 'downloadAllInvoices');

                                                const filename = `${selectedRole}_${invoice.serviceWeek}/${invoice.personnelId.firstName} ${invoice.personnelId.lastName}.pdf`;
                                                zip.file(filename, pdfBlob);

                                                localDownloadCount += 1;
                                                setDownloadCount(localDownloadCount);

                                                setToastOpen({
                                                    content: (
                                                        <div className="w-full text-sm text-gray-800">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                                                                <p className="font-medium">Downloading invoices in progress...</p>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded h-2 mb-1">
                                                                <div
                                                                    className="bg-sky-500 h-2 rounded transition-all duration-300"
                                                                    style={{ width: `${Math.round((localDownloadCount / total) * 100)}%` }}
                                                                />
                                                            </div>
                                                            <p className="text-xs text-gray-600 mb-1">Downloaded {localDownloadCount} of {total}</p>
                                                            <p className="text-xs text-red-500 italic">Please do not navigate away — switching pages will stop the process.</p>
                                                        </div>
                                                    )
                                                });
                                            }

                                            zip.generateAsync({ type: 'blob', streamFiles: true }).then((zipBlob) => {
                                                saveAs(zipBlob, `${selectedInvoices?.length > 0 ? selectedRole : 'all'}_invoices.zip`);
                                            });
                                        } catch (error) {
                                            console.error("Error zipping invoices:", error);
                                            alert("Error zipping invoices.");
                                        } finally {
                                            setDownloadingInvoice(null);
                                            setDownloadCount(0);
                                            setToastOpen({
                                                content: (
                                                    <div className="flex items-center gap-2 text-sky-600 text-sm font-semibold">
                                                        <SuccessTick width={20} height={20} />
                                                        <span>
                                                            {selectedInvoices.length > 1 ? 'Invoices' : 'Invoice'} downloaded successfully.
                                                        </span>
                                                    </div>
                                                )
                                            });
                                            setTimeout(() => setToastOpen(null), 3000);
                                        }
                                    }}

                                >
                                    {downloadingInvoice ? (
                                        <div className="w-3 h-3 border-3 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <i className="flex items-center fi fi-sr-download text-[0.6rem]"></i>
                                    )}
                                    {downloadingInvoice ? `Downloaded ${downloadCount}/${selectedInvoices.length > 0 ? selectedInvoices.length : Object.values(groupedInvoices).length}` : `Download ${selectedInvoices.length === 0 || selectedInvoices.length === Object.values(groupedInvoices).length ? `All (${Object.values(groupedInvoices).length})` : `Selected (${selectedInvoices.length})`}`}
                                </button>
                                <button
                                    disabled={changed || Object.values(groupedInvoices).length === 0 || sendingInvoice || downloadingInvoice || (selectedInvoices.length > 0 ? selectedInvoices.some((invKey) => !groupedInvoices[invKey]?.allCompleted) : Object.values(groupedInvoices).some((ginv) => !ginv.allCompleted))}
                                    className="flex gap-1 items-center text-xs bg-amber-400/50 text-amber-600 rounded px-2 py-1 disabled:bg-gray-300 disabled:text-white"
                                    onClick={async () => {
                                        try {
                                            setSendingInvoice('start');
                                            setToastOpen({
                                                content: (
                                                    <div className="w-full text-sm text-gray-800">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                                                            <p className="font-medium">Sending invoices in progress...</p>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded h-2 mb-1">
                                                            <div
                                                                className="bg-green-500 h-2 rounded transition-all duration-300"
                                                                style={{
                                                                    width: `${Math.round(
                                                                        (sentCount / (selectedInvoices.length > 0
                                                                            ? selectedInvoices.length
                                                                            : Object.values(groupedInvoices).length)) * 100
                                                                    )}%`,
                                                                }}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-gray-600 mb-1">
                                                            Sent {sentCount} of {selectedInvoices.length > 0 ? selectedInvoices.length : Object.values(groupedInvoices).length}
                                                        </p>
                                                        <p className="text-xs text-red-500 italic">
                                                            Please do not navigate away — switching pages will stop the process.
                                                        </p>
                                                    </div>
                                                )
                                            });

                                            setSentCount(0);
                                            stopSendingRef.current = false;

                                            const sortedInvoices = Object.values(groupedInvoices).sort((a, b) => {
                                                const nameA = (a.personnelId.firstName + a.personnelId.lastName).toLowerCase();
                                                const nameB = (b.personnelId.firstName + b.personnelId.lastName).toLowerCase();
                                                return nameA.localeCompare(nameB);
                                            });

                                            let localSentCount = 0; // manually track progress inside the loop
                                            const total = selectedInvoices.length > 0 ? selectedInvoices.length : Object.values(groupedInvoices).length;

                                            for (const invoice of sortedInvoices) {
                                                if (stopSendingRef.current) break;

                                                if (selectedInvoices.length > 0) {
                                                    const ids = selectedInvoices.map((si) => groupedInvoices[si]._id);
                                                    if (!ids.includes(invoice._id)) continue;
                                                }

                                                setSendingInvoice(invoice._id);
                                                const updatedInvoice = { ...invoice, instalments };
                                                await generatePDF(updatedInvoice, 'sendAllInvoices');

                                                localSentCount += 1;
                                                setSentCount(localSentCount); // updates React state

                                                // Update progress bar in toast with latest count
                                                setToastOpen({
                                                    content: (
                                                        <div className="w-full text-sm text-gray-800">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                                                                <p className="font-medium">Sending invoices in progress...</p>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded h-2 mb-1">
                                                                <div
                                                                    className="bg-green-500 h-2 rounded transition-all duration-300"
                                                                    style={{
                                                                        width: `${Math.round((localSentCount / total) * 100)}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <p className="text-xs text-gray-600 mb-1">
                                                                Sent {localSentCount} of {total}
                                                            </p>
                                                            <p className="text-xs text-red-500 italic">
                                                                Please do not navigate away — switching pages will stop the process.
                                                            </p>
                                                        </div>
                                                    )
                                                });
                                                await delay(1000);
                                            }

                                        } catch (error) {
                                            console.error("Error sending invoices:", error);
                                            alert('Error sending invoice');
                                        } finally {
                                            setSendingInvoice(null);
                                            setSentCount(0);
                                            setToastOpen({
                                                content: (
                                                    <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                                                        <SuccessTick width={20} height={20} />
                                                        <span>
                                                            {selectedInvoices.length > 1 ? 'Invoices' : 'Invoice'} sent successfully.
                                                        </span>
                                                    </div>
                                                )
                                            });
                                            setTimeout(() => setToastOpen(null), 3000);
                                        }
                                    }}
                                >
                                    {sendingInvoice ? (
                                        <div className="w-3 h-3 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <i className="fi fi-sr-paper-plane flex items-center text-[0.6rem]"></i>
                                    )}
                                    {sendingInvoice ? `Sent ${sentCount}/${selectedInvoices.length > 0 ? selectedInvoices.length : Object.values(groupedInvoices).length}` : `Send ${selectedInvoices.length === 0 || selectedInvoices.length === Object.values(groupedInvoices).length ? `All (${Object.values(groupedInvoices).length})` : `Selected (${selectedInvoices.length})`}`}
                                </button>
                                {sendingInvoice && (
                                    <button
                                        className="text-xs bg-red-600 text-white rounded-md px-2 py-1"
                                        onClick={() => {
                                            stopSendingRef.current = true;
                                            setSendingInvoice('stop');
                                        }}
                                    >
                                        {sendingInvoice === 'stop' ? 'Stopping..' : 'Stop'}
                                    </button>
                                )}
                                {downloadingInvoice && (
                                    <button
                                        className="text-xs bg-red-600 text-white rounded-md px-2 py-1"
                                        onClick={() => {
                                            stopDownloadingRef.current = true;
                                            setDownloadingInvoice('stop');
                                        }}
                                    >
                                        {downloadingInvoice === 'stop' ? 'Stopping..' : 'Stop'}
                                    </button>
                                )}
                                {selectedInvoices.length > 0 && !sendingInvoice && !downloadingInvoice &&
                                    <button className='text-xs bg-red-600 text-white rounded-md px-2 py-1' onClick={() => setSelectedInvoices([])}>Clear</button>
                                }
                                {selectedInvoices.length !== Object.values(groupedInvoices).length && !sendingInvoice && !downloadingInvoice &&
                                    <button onClick={() => setSelectedInvoices(Object.values(groupedInvoices).map((ginv) => `${ginv.personnelId._id}_${ginv.serviceWeek}`))} className='text-xs bg-primary-600 text-white rounded-md px-2 py-1'>Select All</button>
                                }
                            </div>
                        </div>
                    </div>
                    <div className="relative rounded-t-lg flex-1 overflow-auto">
                        <table className="calendar-table text-xs md:text-base w-full border border-neutral-200 dark:border-dark-4">
                            <thead>
                                <tr className="text-white">
                                    <th className="sticky top-0 left-0 z-20 bg-primary-800 border-r-[1.5px] border-primary-500 font-medium max-sm:!max-w-25 max-sm:!whitespace-normal">
                                        Personnel List
                                    </th>
                                    {weeks.map((week) => (
                                        <th
                                            className="sticky top-0 z-10 bg-primary-800 border-r-[1.5px] border-primary-500 font-light"
                                            key={week.week}
                                        >
                                            <div className="flex justify-center gap-2 items-center">
                                                <div>{week.week}</div>
                                                <button
                                                    disabled={Object.values(groupedInvoices).filter(ginv => ginv.serviceWeek === week.week).length === 0 || downloadingInvoice || sendingInvoice}
                                                    onClick={() => {
                                                        const newSelections = Object.values(groupedInvoices)
                                                            .filter(ginv => ginv.serviceWeek === week.week)
                                                            .map(ginv => `${ginv.personnelId._id}_${ginv.serviceWeek}`);
                                                        const allSelected = newSelections.every(id => selectedInvoices.includes(id));
                                                        if (allSelected) {
                                                            setSelectedInvoices(selectedInvoices.filter(id => !newSelections.includes(id)));
                                                        } else {
                                                            const merged = new Set([...selectedInvoices, ...newSelections]);
                                                            setSelectedInvoices(Array.from(merged));
                                                        }
                                                    }}
                                                    className={`h-7 w-7 rounded-full p-2 bg-gray-100 shadow border border-gray-200 disabled:!text-gray-300 ${Object.values(groupedInvoices)
                                                        .filter(ginv => ginv.serviceWeek === week.week)
                                                        .every(ginv => selectedInvoices.includes(`${ginv.personnelId._id}_${ginv.serviceWeek}`))
                                                        ? 'text-primary-200'
                                                        : 'text-neutral-500'
                                                        }`}
                                                >
                                                    <i className={`flex items-center fi fi-rr-choose text-[0.9rem]`}></i>
                                                </button>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {personnelsList.filter((personnel) => {
                                    if (searchPersonnel !== '') {
                                        return String(personnel.firstName + ' ' + personnel.lastName)
                                            .toLowerCase()
                                            .includes(searchPersonnel.toLowerCase())

                                    }
                                    if (selectedVehicleType !== '') {
                                        return personnel.typeOfPersonnel === selectedVehicleType
                                    }
                                    else
                                        return true
                                }).map((personnel) => (
                                    <tr key={personnel._id}>
                                        <td className="z-10 sticky left-0 bg-white dark:bg-dark-3">
                                            <div className="flex max-sm:flex-col gap-2 justify-between items-center">
                                                <p>{personnel.firstName + ' ' + personnel.lastName}</p>
                                            </div>
                                        </td>
                                        {tableData(personnel)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <Modal isOpen={currentInvoice}>
                <h2 className="text-xl font-semibold px-2 md:px-6 py-2 text-gray-800 dark:text-white border-b border-neutral-300">
                    Weekly Invoice Details
                </h2>
                <div className="p-2 md:p-6 mx-auto max-h-[40rem] overflow-auto">
                    {/* Personnel Information */}
                    <div className="mb-6">
                        <InputWrapper title={'Personnel Information'}>
                            <div className="grid grid-cols-1 md:grid-cols-[4fr_5fr_2fr_2fr] gap-4">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">
                                        {currentInvoice?.invoice.personnelId.firstName + ' ' + currentInvoice?.invoice.personnelId.lastName}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">
                                        {currentInvoice?.invoice.personnelId.Email}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">User ID</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">
                                        {currentInvoice?.invoice.personnelId.user_ID}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Due Date:</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">
                                        {moment(currentInvoice?.invoice?.serviceWeek, 'GGGG-[W]WW').add(3, 'weeks').startOf('week').add(3, 'days').format('dddd,DD/MM/YYYY')}
                                    </p>
                                </div>
                                {currentInvoice?.invoice.personnelId.vatDetails?.vatNo && (
                                    <>
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Personnel VAT Number</p>
                                            <p className="text-base font-medium text-gray-900 dark:text-white">
                                                {currentInvoice.invoice.personnelId.vatDetails.vatNo}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Effective Date</p>
                                            <p className="text-base font-medium text-gray-900 dark:text-white">
                                                {new Date(currentInvoice.invoice.personnelId.vatDetails.vatEffectiveDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </>
                                )}
                                {currentInvoice?.invoice.personnelId.companyVatDetails?.companyVatNo && (
                                    <>
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Company VAT Number</p>
                                            <p className="text-base font-medium text-gray-900 dark:text-white">
                                                {currentInvoice.invoice.personnelId.companyVatDetails.companyVatNo}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Effective Date</p>
                                            <p className="text-base font-medium text-gray-900 dark:text-white">
                                                {new Date(currentInvoice.invoice.personnelId.companyVatDetails.companyVatEffectiveDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </InputWrapper>
                    </div>
                    {/* Invoice Summary */}
                    <div className="mb-6">
                        <InputWrapper title={'Invoice Summary'}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Service Week</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{currentInvoice?.invoice.serviceWeek}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Site</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{currentInvoice?.invoice.personnelId.siteSelection}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Reference Number</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{currentInvoice?.invoice.referenceNumber}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Invoices</p>
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{currentInvoice?.invoice.count}</p>
                                </div>
                            </div>
                        </InputWrapper>
                    </div>
                    {/* Installments Wrapper */}
                    {currentInvoice?.instalments?.length > 0 &&
                        (currentInvoice?.instalments?.some((insta) => insta.installmentPending > 0 || currentInvoice?.invoice?.installmentDetail.some(
                            (cinsta) => cinsta._id.toString() === insta._id.toString()))) && (
                            <InputWrapper title="Instalments">
                                {currentInvoice.instalments.filter((insta) => insta.installmentPending > 0 || currentInvoice?.invoice?.installmentDetail.some(
                                    (cinsta) => cinsta._id.toString() === insta._id.toString())).map((insta) => {
                                        const existingDetails = currentInvoice?.invoice?.installmentDetail || [];
                                        const isChecked = existingDetails.some(
                                            (cinsta) => cinsta._id.toString() === insta._id.toString()
                                        );
                                        const matchedDetail = existingDetails.find(
                                            (cinsta) => cinsta._id.toString() === insta._id.toString()
                                        );
                                        const currentTotal = currentInvoice?.invoice?.total ?? 0;
                                        const deductionAmount = matchedDetail
                                            ? matchedDetail.deductionAmount.toFixed(2)
                                            : Math.max(
                                                0,
                                                Math.min(insta.spreadRate, currentTotal, insta.installmentPending)
                                            ).toFixed(2);
                                        const isDisabled = Number(deductionAmount) === 0 && !isChecked;
                                        return (
                                            <div
                                                key={insta._id}
                                                className="flex max-sm:flex-col items-center gap-5 justify-between"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="h-[50%] self-start w-4 accent-primary-400 rounded focus:ring-primary-400"
                                                    checked={isChecked}
                                                    disabled={isDisabled}
                                                    onChange={(e) => {
                                                        setChanged(true);
                                                        const checked = e.target.checked;
                                                        setCurrentInvoice((prev) => {
                                                            const prevInvoice = prev.invoice || {};
                                                            const prevDetails = prevInvoice.installmentDetail || [];
                                                            const toggledId = insta._id.toString();
                                                            if (!checked) {
                                                                const uncheckedDetail = prevDetails.find(
                                                                    (d) => d._id.toString() === toggledId
                                                                );
                                                                const uncheckedDeduction = uncheckedDetail?.deductionAmount ?? 0;
                                                                let restoredTotal = (prevInvoice.total ?? 0) + prevDetails.reduce(
                                                                    (sum, d) => sum + d.deductionAmount,
                                                                    0
                                                                );
                                                                restoredTotal = parseFloat(restoredTotal.toFixed(2));
                                                                const remainingIds = prevDetails
                                                                    .map((d) => d._id.toString())
                                                                    .filter((id) => id !== toggledId);
                                                                let newTotal = restoredTotal;
                                                                const newInstallmentDetail = [];
                                                                const updatedInstalments = (prev.instalments || []).map((item) => {
                                                                    const id = item._id.toString();
                                                                    if (remainingIds.includes(id)) {
                                                                        const deduction = Math.max(
                                                                            0,
                                                                            Math.min(item.spreadRate, newTotal, item.installmentPending + (prevDetails.find(d => d._id.toString() === id)?.deductionAmount || 0))
                                                                        );
                                                                        const roundedDeduction = parseFloat(deduction.toFixed(2));
                                                                        newTotal = parseFloat((newTotal - roundedDeduction).toFixed(2));
                                                                        newInstallmentDetail.push({
                                                                            _id: item._id,
                                                                            installmentType: item.installmentType,
                                                                            deductionAmount: roundedDeduction,
                                                                        });
                                                                        return {
                                                                            ...item,
                                                                            installmentPending: parseFloat(
                                                                                (
                                                                                    Math.min(
                                                                                        item.installmentPending +
                                                                                        (prevDetails.find(d => d._id.toString() === id)?.deductionAmount || 0),
                                                                                        item.installmentRate
                                                                                    ) - roundedDeduction
                                                                                ).toFixed(2)
                                                                            ),
                                                                        };
                                                                    }
                                                                    if (id === toggledId) {
                                                                        return {
                                                                            ...item,
                                                                            installmentPending: parseFloat(
                                                                                (
                                                                                    Math.min(
                                                                                        item.installmentPending + uncheckedDeduction,
                                                                                        item.installmentRate
                                                                                    )
                                                                                ).toFixed(2)
                                                                            ),
                                                                        };
                                                                    }
                                                                    return item;
                                                                });
                                                                return {
                                                                    ...prev,
                                                                    invoice: {
                                                                        ...prev.invoice,
                                                                        total: newTotal,
                                                                        installmentDetail: newInstallmentDetail,
                                                                    },
                                                                    instalments: updatedInstalments,
                                                                };
                                                            } else {
                                                                const isAlreadySelected = prevDetails.some(
                                                                    (d) => d._id.toString() === toggledId
                                                                );
                                                                if (isAlreadySelected) return prev;
                                                                const newTotal = prevInvoice.total ?? 0;
                                                                const deduction = Math.max(
                                                                    0,
                                                                    Math.min(insta.spreadRate, newTotal, insta.installmentPending)
                                                                );
                                                                const roundedDeduction = parseFloat(deduction.toFixed(2));
                                                                if (roundedDeduction === 0) return prev;
                                                                const newInstallmentDetail = [
                                                                    ...prevDetails,
                                                                    {
                                                                        _id: insta._id,
                                                                        installmentType: insta.installmentType,
                                                                        deductionAmount: roundedDeduction,
                                                                    },
                                                                ];
                                                                const newInstalments = (prev.instalments || []).map((instaItem) => {
                                                                    if (instaItem._id.toString() === toggledId) {
                                                                        return {
                                                                            ...instaItem,
                                                                            installmentPending: parseFloat(
                                                                                (
                                                                                    instaItem.installmentPending - roundedDeduction
                                                                                ).toFixed(2)
                                                                            ),
                                                                        };
                                                                    }
                                                                    return instaItem;
                                                                });
                                                                return {
                                                                    ...prev,
                                                                    invoice: {
                                                                        ...prev.invoice,
                                                                        total: parseFloat((newTotal - roundedDeduction).toFixed(2)),
                                                                        installmentDetail: newInstallmentDetail,
                                                                    },
                                                                    instalments: newInstalments,
                                                                };
                                                            }
                                                        });
                                                    }}
                                                />
                                                <div className="grid grid-cols-2 md:grid-cols-4 space-x-4 space-y-2">
                                                    <InputGroup
                                                        disabled={true}
                                                        label="Instalment Type"
                                                        value={insta.installmentType}
                                                    />
                                                    <InputGroup
                                                        disabled={true}
                                                        icon={<FaPoundSign className="text-neutral-300" size={20} />}
                                                        iconPosition="left"
                                                        label="Instalment Total"
                                                        value={insta.installmentRate.toFixed(2)}
                                                    />
                                                    <InputGroup
                                                        disabled={true}
                                                        label="Instalment Tenure"
                                                        value={`${insta.tenure} week${insta.tenure > 1 ? 's' : ''}`}
                                                    />
                                                    <InputGroup
                                                        disabled={true}
                                                        icon={<FaPoundSign className="text-neutral-300" size={20} />}
                                                        iconPosition="left"
                                                        label="Instalment Spread Rate"
                                                        value={insta.spreadRate.toFixed(2)}
                                                    />
                                                    <InputGroup
                                                        disabled={true}
                                                        icon={<FaPoundSign className="text-neutral-300" size={20} />}
                                                        iconPosition="left"
                                                        label="Instalment Pending"
                                                        value={insta.installmentPending.toFixed(2)}
                                                    />
                                                    <InputGroup
                                                        disabled={true}
                                                        icon={<FaPoundSign className="text-neutral-300" size={20} />}
                                                        iconPosition="left"
                                                        label="Deduction Amount"
                                                        value={deductionAmount}
                                                    />
                                                    <div className="flex items-center justify-center text-xs w-15">
                                                        {insta.signed ? (
                                                            <p className="bg-green-400/30 text-green-700 px-2 py-1 rounded-md">
                                                                Signed
                                                            </p>
                                                        ) : (
                                                            <p className="bg-yellow-400/30 text-yellow-700 px-2 py-1 rounded-md">
                                                                Unsigned
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </InputWrapper>
                        )}
                    {/* Daily Invoices */}
                    <div className="mb-6">
                        <InputWrapper title={'Invoices'}>
                            <div className="overflow-x-auto rounded-lg">
                                <table className="min-w-full border-collapse border border-gray-200 dark:border-dark-5 mb-2">
                                    <thead>
                                        <tr className="bg-primary-800 !text-white">
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Status</th>
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Date</th>
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Main Service</th>
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Service Rate</th>
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">BYOD Rate</th>
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Total Miles</th>
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Mileage Rate</th>
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Calculated Mileage</th>
                                            {currentInvoice?.invoice.invoices.some(
                                                (invoice) =>
                                                    invoice.additionalServiceDetails?.service || invoice.additionalServiceApproval === 'Requested'
                                            ) && (
                                                    <>
                                                        <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">
                                                            Additional Service Type
                                                        </th>
                                                        <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">
                                                            Additional Service Total
                                                        </th>
                                                    </>
                                                )}
                                            {currentInvoice?.invoice.invoices.some(
                                                (invoice) => invoice.incentiveDetailforMain?.length > 0 || invoice.incentiveDetailforAdditional?.length > 0) && (
                                                    <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Incentive Rate</th>)}
                                            {/* {currentInvoice?.invoice.invoices.some(
                                                (invoice) => invoice.deductionDetail?.length > 0) && (
                                                    <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Total Deductions</th>
                                                )} */}
                                            {currentInvoice?.invoice.invoices.some(
                                                (invoice) =>
                                                    (currentInvoice?.invoice.personnelId?.vatDetails?.vatNo !== '' &&
                                                        new Date(invoice.date) >= new Date(currentInvoice?.invoice.personnelId?.vatDetails?.vatEffectiveDate)) ||
                                                    (currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatNo !== '' &&
                                                        new Date(invoice.date) >= new Date(currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatEffectiveDate))
                                            ) && (
                                                    <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">VAT</th>
                                                )}
                                            <th className="text-xs dark:text-gray-400 px-4 py-2 border-r border-primary-600 dark:border-dark-5">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentInvoice?.invoice.invoices
                                            .sort((a, b) => new Date(a.date) - new Date(b.date))
                                            .map((invoice, index) => {
                                                const totalDeductions = invoice.deductionDetail?.reduce((sum, ded) => {
                                                    return sum + parseFloat(ded.rate || 0);
                                                }, 0);
                                                const hasPersonnelVat =
                                                    currentInvoice?.invoice.personnelId?.vatDetails?.vatNo !== '' &&
                                                    new Date(invoice.date) >= new Date(currentInvoice?.invoice.personnelId?.vatDetails?.vatEffectiveDate);
                                                const hasCompanyVat =
                                                    currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatNo !== '' && currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatEffectiveDate &&
                                                    new Date(invoice.date) >= new Date(currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatEffectiveDate);
                                                return (
                                                    <tr key={invoice._id} className={index % 2 === 0 ? 'bg-white dark:bg-dark-3' : 'bg-gray-50 dark:bg-dark-4'}>
                                                        <td className='text-sm font-medium text-gray-900 dark:text-white px-2 py-2 border border-gray-200 dark:border-dark-5'>
                                                            <div className='w-full flex justify-center items-center gap-1 text-xs'><div>{stageIcons[invoice.approvalStatus]}</div></div>
                                                        </td>
                                                        <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                            {new Date(invoice.date).toLocaleDateString('en-UK')}
                                                        </td>
                                                        <td className="text-sm font-medium text-gray-900 dark:text-white px-2 py-2 border border-gray-200 dark:border-dark-5">
                                                            {invoice.mainService === 'Route Support' ? `${invoice?.incentiveDetailforMain
                                                                ?.map(item => item.routeSupportService)
                                                                .filter(Boolean)
                                                                .join(', ')} (Route Support )` : `${invoice.mainService}  ${invoice.site !== currentInvoice?.invoice?.personnelId?.siteSelection ? `(${invoice.site})` : ''}`}
                                                        </td>
                                                        <td className="text-sm font-medium text-green-600 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                            £{invoice.serviceRateforMain}
                                                        </td>
                                                        <td className="text-sm font-medium text-green-600 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                            £{invoice.byodRate}
                                                        </td>
                                                        <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                            {invoice.miles}
                                                        </td>
                                                        <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                            £{invoice.mileage}
                                                        </td>
                                                        <td className="text-sm font-medium text-green-600 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                            £{invoice.calculatedMileage}
                                                        </td>
                                                        {currentInvoice?.invoice.invoices.some(
                                                            (inv) => inv.additionalServiceDetails?.service || inv.additionalServiceApproval === 'Requested'
                                                        ) && (
                                                                <>
                                                                    <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                                        {invoice.additionalServiceApproval === 'Requested' ? (
                                                                            <div className="bg-red-200/40 text-red-400 text-xs px-2 py-1 rounded">Waiting for approval</div>
                                                                        ) : (
                                                                            invoice.additionalServiceDetails?.service === 'Route Support' ? `${invoice?.incentiveDetailforAdditional
                                                                                ?.map(item => item.routeSupportService)
                                                                                .filter(Boolean)
                                                                                .join(', ')} (Route Support )` : `${invoice.additionalServiceDetails?.service === 'Other' && invoice.additionalServiceDetails?.remarks ? `${invoice.additionalServiceDetails?.remarks} (Other)` : invoice.additionalServiceDetails?.service || '-'} `
                                                                        )}
                                                                    </td>
                                                                    <td className="text-sm font-medium dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                                        {invoice.additionalServiceApproval === 'Requested' ? (
                                                                            <div className="bg-red-200/40 text-red-400 text-xs px-2 py-1 rounded">Waiting for approval</div>
                                                                        ) : (
                                                                            invoice.serviceRateforAdditional ? (
                                                                                <p className="text-sm font-medium text-green-600">
                                                                                    £{(Number(invoice.serviceRateforAdditional) - Number(invoice.incentiveDetailforAdditional?.reduce((sum, inc) => sum + Number(inc.rate || 0), 0) || 0)).toFixed(2)}
                                                                                </p>
                                                                            ) : '-'
                                                                        )}
                                                                    </td>
                                                                </>
                                                            )}
                                                        {currentInvoice?.invoice.invoices.some(
                                                            (invoice) => invoice.incentiveDetailforMain?.length > 0 || invoice.incentiveDetailforAdditional?.length > 0) && (
                                                                <td className="text-sm font-medium text-green-600 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                                    £{Number(invoice.incentiveDetailforMain?.reduce((sum, inc) => sum + Number(inc.rate || 0), 0) || 0) + Number(invoice.incentiveDetailforAdditional?.reduce((sum, inc) => sum + Number(inc.rate || 0), 0) || 0)}
                                                                </td>
                                                            )}
                                                        {/* {currentInvoice?.invoice.invoices.some(
                                                            (invoice) => invoice.deductionDetail?.length > 0) && (
                                                                <td className="text-sm font-medium text-red-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                                    {totalDeductions > 0 ? `-£${totalDeductions}` : `-`}
                                                                </td>
                                                            )} */}
                                                        {currentInvoice?.invoice.invoices.some(
                                                            (inv) =>
                                                                (currentInvoice?.invoice.personnelId?.vatDetails?.vatNo !== '' &&
                                                                    new Date(inv.date) >= new Date(currentInvoice?.invoice.personnelId?.vatDetails?.vatEffectiveDate)) ||
                                                                (currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatNo !== '' &&
                                                                    new Date(inv.date) >= new Date(currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatEffectiveDate))
                                                        ) && (
                                                                <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                                    {hasPersonnelVat || hasCompanyVat ? '20%' : '-'}
                                                                </td>
                                                            )}
                                                        <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                            £{(invoice.total + totalDeductions).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        <tr>
                                            <td
                                                colSpan={
                                                    7 +
                                                    (currentInvoice?.invoice.invoices.some(
                                                        (invoice) => invoice.incentiveDetailforMain?.length > 0 || invoice.incentiveDetailforAdditional?.length > 0) ? 1 : 0) +
                                                    (currentInvoice?.invoice.invoices.some(
                                                        (invoice) => invoice.deductionDetail?.length > 0) ? 0 : 0) +
                                                    (currentInvoice?.invoice.invoices.some(
                                                        (invoice) =>
                                                            invoice.additionalServiceDetails?.service || invoice.additionalServiceApproval === 'Requested'
                                                    )
                                                        ? 2
                                                        : 0)
                                                }
                                            ></td>
                                            <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                Subtotal:
                                            </td>
                                            {currentInvoice?.invoice.invoices.some(
                                                (invoice) =>
                                                    (currentInvoice?.invoice.personnelId?.vatDetails?.vatNo !== '' &&
                                                        new Date(invoice.date) >= new Date(currentInvoice?.invoice.personnelId?.vatDetails?.vatEffectiveDate)) ||
                                                    (currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatNo !== '' &&
                                                        new Date(invoice.date) >= new Date(currentInvoice?.invoice.personnelId?.companyVatDetails?.companyVatEffectiveDate))
                                            ) && (
                                                    <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                        £{currentInvoice?.invoice.vatTotal}
                                                    </td>
                                                )}
                                            <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                £{((currentInvoice?.invoice?.invoices?.reduce((sum, inv) => sum + (inv?.total || 0), 0) || 0) + (currentInvoice?.invoice.invoices?.flatMap(inv => inv?.deductionDetail?.map(d => ({ ...d, date: inv.date })) || [])?.reduce((totalDeduction, ded) => totalDeduction + (ded?.rate || 0), 0) || 0)).toFixed(2)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td
                                                colSpan={
                                                    7 +
                                                    (currentInvoice?.invoice.invoices.some(
                                                        (invoice) => invoice.incentiveDetailforMain?.length > 0 || invoice.incentiveDetailforAdditional?.length > 0) ? 1 : 0) +
                                                    (currentInvoice?.invoice.invoices.some(
                                                        (invoice) => invoice.deductionDetail?.length > 0) ? 0 : 0) +
                                                    (currentInvoice?.invoice.invoices.some(
                                                        (invoice) =>
                                                            invoice.additionalServiceDetails?.service || invoice.additionalServiceApproval === 'Requested'
                                                    )
                                                        ? 2
                                                        : 0)
                                                }
                                            ></td>
                                            <td className="text-sm font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                Total:
                                            </td>
                                            <td colSpan={2} className="text-sm text-center font-medium text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">
                                                £{(currentInvoice?.invoice.invoices.reduce((sum, inv) => inv.total + sum || 0, 0) + (currentInvoice?.invoice.vatTotal) + (currentInvoice?.invoice.invoices?.flatMap(inv => inv?.deductionDetail?.map(d => ({ ...d, date: inv.date })) || [])?.reduce((totalDeduction, ded) => totalDeduction + (ded?.rate || 0), 0) || 0)).toFixed(2)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="grid grid-cols-2 w-full gap-2">
                                {currentInvoice?.invoice.installmentDetail?.length > 0 && (
                                    <div className="rounded-lg w-full overflow-hidden">
                                        <table className="min-w-full border-collapse border border-gray-200 dark:border-dark-5">
                                            <thead>
                                                <tr className="bg-primary-800 text-white">
                                                    <th className="text-xs px-4 py-2 border-r border-primary-600">Instalment Type</th>
                                                    <th className="text-xs px-4 py-2 border-r border-primary-600">Deducted Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentInvoice.invoice.installmentDetail.map(insta => (
                                                    <tr key={insta._id} className="bg-gray-50 dark:bg-dark-4">
                                                        <td className="text-sm text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">{insta.installmentType}</td>
                                                        <td className="text-sm text-red-700 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5"> - £{insta.deductionAmount}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {currentInvoice?.invoice.invoices.some(
                                    (invoice) => invoice.deductionDetail?.length > 0) && (
                                        <div className="rounded-lg w-full overflow-hidden">
                                            <table className="min-w-full border-collapse border border-gray-200 dark:border-dark-5">
                                                <thead>
                                                    <tr className="bg-primary-800 text-white">
                                                        <th className="text-xs px-4 py-2 border-r border-primary-600">Deduction Date</th>
                                                        <th className="text-xs px-4 py-2 border-r border-primary-600">Deduction Type</th>
                                                        <th className="text-xs px-4 py-2 border-r border-primary-600">Deducted Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentInvoice.invoice.invoices.map(inv => (
                                                        <>
                                                            {inv.deductionDetail?.map((ded) => (
                                                                <tr className='min-w-full'>
                                                                    <td className="text-sm text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">{new Date(ded.date).toLocaleDateString()}</td>
                                                                    <td className="text-sm text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">{ded.serviceType}</td>
                                                                    <td className="text-sm text-red-700 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5"> - £{ded.rate}</td>
                                                                </tr>
                                                            ))}
                                                        </>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                {currentInvoice?.invoice.additionalChargesDetail?.length > 0 && (
                                    <div className="rounded-lg w-full overflow-hidden">
                                        <table className="min-w-full border-collapse border border-gray-200 dark:border-dark-5">
                                            <thead>
                                                <tr>
                                                    <th colSpan={2} className="text-xs bg-primary-800 text-white px-4 py-1 border-b border-primary-600">Additional Charges</th>
                                                </tr>
                                                <tr className="bg-primary-800 text-white">
                                                    <th className="text-xs px-4 py-2 border-r border-primary-600">Charge Title</th>
                                                    <th className="text-xs px-4 py-2 border-r border-primary-600">Charge Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {currentInvoice?.invoice.additionalChargesDetail.map((adc) => (
                                                    <tr className="bg-gray-50 dark:bg-dark-4">
                                                        <td className="text-sm text-gray-900 dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5">{adc.title}</td>
                                                        <td className={`text-sm ${adc.type === 'addition' ? 'text-green-500' : 'text-red-700'} dark:text-white px-4 py-2 border border-gray-200 dark:border-dark-5`}> {adc.type === 'addition' ? '+' : '-'} £{adc.rate} {adc?.vat && '(20% vat included)'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </InputWrapper>
                    </div>
                    {/* Weekly Total */}
                    <div className="mt-6 flex justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Weekly Total</h3>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                £{currentInvoice?.invoice.total}
                            </p>
                        </div>
                    </div>
                    {/* Download or Send Invoice */}
                    <div className="flex gap-3 p-3 rounded-lg border-2 border-neutral-300 mt-2 w-full">
                        <div className="w-full">
                            <button
                                disabled={changed || !currentInvoice?.invoice?.allCompleted}
                                className="flex gap-2 bg-sky-400/50 items-center text-sm text-sky-600 rounded px-2 py-1 disabled:bg-gray-300 disabled:text-white"
                                onClick={() => generatePDF(currentInvoice.invoice, 'downloadInvoice')}
                            >
                                <i className="flex items-center fi fi-sr-download"></i>
                                Download Invoice
                            </button>
                            {currentInvoice?.invoice?.downloadInvoice?.length > 0 && (
                                <div className="rounded-lg overflow-auto border border-neutral-200 mt-2 max-h-[15rem]">
                                    <table className="table-general">
                                        <thead className="sticky top-0 bg-white">
                                            <tr>
                                                <th colSpan={3}>History of Downloaded Invoices</th>
                                            </tr>
                                            <tr>
                                                <th>Downloaded On</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentInvoice.invoice?.downloadInvoice?.sort((a, b) => new Date(b.date) - new Date(a.date)).map((dInvoice) => (
                                                <tr key={dInvoice.date}>
                                                    <td>{new Date(dInvoice.date).toLocaleString()}</td>
                                                    <td>
                                                        <div className="flex justify-center">
                                                            <a className="flex w-fit bg-purple-300/50 text-purple-500 rounded p-2" target="_blank" href={dInvoice.document}>
                                                                <i className="flex items-center fi text-[1rem] fi-sr-file-download"></i>
                                                            </a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        <div className="w-full">
                            <button
                                disabled={changed || !currentInvoice?.invoice?.allCompleted}
                                className="flex gap-2 items-center text-sm bg-amber-400/50 text-amber-600 rounded px-2 py-1 disabled:bg-gray-300 disabled:text-white"
                                onClick={() => {
                                    setSendingOneInvoice(true);
                                    generatePDF(currentInvoice.invoice, 'sentInvoice').then(() => setSendingOneInvoice(false));
                                }}
                            >
                                {sendingOneInvoice ? (
                                    <div className="w-3 h-3 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <i className="fi fi-sr-paper-plane flex items-center"></i>
                                )}
                                Send Invoice
                            </button>
                            {currentInvoice?.invoice?.sentInvoice?.length > 0 && (
                                <div className="rounded-lg overflow-auto border border-neutral-200 mt-2 max-h-[15rem]">
                                    <table className="table-general">
                                        <thead className="sticky top-0 bg-white">
                                            <tr>
                                                <th colSpan={3}>History of Sent Invoices</th>
                                            </tr>
                                            <tr>
                                                <th>Sent On</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentInvoice.invoice?.sentInvoice?.sort((a, b) => new Date(b.date) - new Date(a.date)).map((sInvoice) => (
                                                <tr key={sInvoice.date}>
                                                    <td>{new Date(sInvoice.date).toLocaleString()}</td>
                                                    <td>
                                                        <div className="flex justify-center">
                                                            <a className="flex w-fit bg-purple-300/50 text-purple-500 rounded p-2" target="_blank" href={sInvoice.document}>
                                                                <i className="flex items-center fi text-[1rem] fi-sr-file-download"></i>
                                                            </a>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="border-t border-neutral-300 flex px-2 md:px-6 py-2 justify-end gap-2 items-center">
                    <button
                        disabled={sendingOneInvoice}
                        className="px-2 py-1 h-fit bg-gray-500 rounded-md text-white hover:bg-gray-600 disabled:bg-gray-300"
                        onClick={() => { setCurrentInvoice(null); setChanged(false); }}
                    >
                        Close
                    </button>
                    <button
                        disabled={!changed || sendingOneInvoice}
                        className="px-2 py-1 h-fit bg-amber-500 rounded-md text-white hover:bg-amber-600 disabled:bg-gray-300"
                        onClick={() => handleUpdateInvoice(currentInvoice)}
                    >
                        Update
                    </button>
                    <button
                        disabled={changed || !currentInvoice?.invoice?.allCompleted || sendingOneInvoice}
                        onClick={() => generatePDF(currentInvoice.invoice, 'print')}
                        className="px-2 h-fit py-1 bg-primary-500 rounded-md text-white hover:bg-primary-600 disabled:bg-gray-300"
                    >
                        Print Weekly Invoice
                    </button>
                </div>
            </Modal >
        </div >
    );
};

export default WeeklyInvoice;