import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import moment from 'moment';
import axios from 'axios';
import { jsPDF } from "jspdf";
import InputWrapper from '../../components/InputGroup/InputWrapper';
import { debounce } from 'lodash';
import { fetchSites } from '../../features/sites/siteSlice';
import WeekInput from '../../components/Calendar/WeekInput';
import { FiChevronRight, FiChevronDown } from "react-icons/fi";
import SuccessTick from '../../components/UIElements/SuccessTick';
import Exclamation from '../../components/UIElements/Exclamation';
import autoTable from "jspdf-autotable";
import InputGroup from '../../components/InputGroup/InputGroup';
import { fetchPersonnels } from '../../features/personnels/personnelSlice';
import { fetchRoles } from '../../features/roles/roleSlice';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const SpendingInsights = () => {
    const dispatch = useDispatch();
    const { userDetails } = useSelector((state) => state.auth);
    const { list: sites, siteStatus } = useSelector((state) => state.sites);
    const { list: roles, roleStatus } = useSelector((state) => state.roles);
    const personnelsByRole = useSelector((state) => state.personnels.byRole);
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedSite, setSelectedSite] = useState(userDetails.siteSelection[0] || '');
    const [selectedWeek, setSelectedWeek] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const contentRef = useRef(null);
    const [rangeType, setRangeType] = useState('weekly');
    const [rangeOptions, setRangeOptions] = useState({});
    const [selectedRangeIndex, setSelectedRangeIndex] = useState();
    const [personnelsList, setPersonnelsList] = useState([]);
    const [searchPersonnel, setSearchPersonnel] = useState('');
    const [days, setDays] = useState([]);
    const [selectedTab, setSelectedTab] = useState("PL");
    const [toastOpen, setToastOpen] = useState(false)
    const [totalServices, setTotalServices] = useState(0);
    const [clientInvoiceAmt, setClientInvoiceAmt] = useState();
    const [incentiveAmt, setIncentiveAmt] = useState();

    ////////////////////////////////////////////////////////////////////////////////////
    const [totalExp, setTotalExp] = useState(0);
    const [totalPL, setTotalPL] = useState(0);
    const [totalAdd, setTotalAdd] = useState(0);
    const [totalMiles, setTotalMiles] = useState(0);
    const [addCharges, setAddCharges] = useState([]);
    const [dayInvoices, setDayInvoices] = useState([]);
    const [weeklyInvoices, setWeeklyInvoices] = useState([]);

    ////////////////////////////////////////////////////////////////////////////////////

    const state = { rangeType, rangeOptions, selectedRangeIndex, days, selectedSite, searchPersonnel, personnelsList };
    const setters = { setRangeType, setRangeOptions, setSelectedRangeIndex, setDays, setSelectedSite, setSearchPersonnel, setPersonnelsList };

    useEffect(() => {
        if (siteStatus === 'idle') dispatch(fetchSites())
        if (roleStatus === 'idle') dispatch(fetchRoles());
        dispatch(fetchPersonnels());
    }, [siteStatus, roleStatus, dispatch]);

    useEffect(() => {
        const currentWeek = moment().format('YYYY-[W]WW');
        setSelectedWeek(currentWeek);
    }, []);

    useEffect(() => {
      if (sites.length > 0 && !selectedSite) {
        setSelectedSite(sites[0].siteKeyword);
      }
    }, [sites, selectedSite]);

    const fetchWeeklyInvoices = async () => {

      const personnelsList = selectedRole ? personnelsByRole[selectedRole] || [] : Object.values(personnelsByRole).flat().filter(p => !p.disabled);
      const personnelIds = personnelsList.map((personnel) => personnel._id);

      console.log("List of Personnels = ", personnelsList);

      if (personnelIds.length === 0) return;
      
      try {
        const response = await axios.post(`${API_BASE_URL}/api/weeklyInvoice`, {
                personnelIds: personnelIds,
                serviceWeeks: [selectedWeek],
        });
        console.log("Fetched Weekly Invoices = ", response.data.data);
        const weeklyInvoices = response.data.data;
        setWeeklyInvoices(response.data.data);

        //Company Incentive - Not used anywhere in the current Build except displaying and storing from ProfitLoss.
        const incentiveResponse = await axios.get(`${API_BASE_URL}/api/companyincentive/by-site-week`, {
          params: {
            site: selectedSite,
            week: selectedWeek
          }
        });
        if (incentiveResponse.data) {
          setIncentiveAmt(incentiveResponse.data.amount);
        }

        //Total Expenses Calculation
        const totalExpenses = weeklyInvoices.reduce((sum, inv) => sum + inv.total, 0);
        setTotalExp(totalExpenses);

        let totalCount = 0;

        weeklyInvoices.forEach((invoice) => {
          // Base count
          totalCount += invoice.count || 0;
        
          invoice.invoices.forEach((inv) => {
            // Additional service count
            if (inv.additionalServiceDetails?.service) {
              totalCount += 1;
            }
          });
        });

        setTotalServices(totalCount);

        console.log(deductionBreakdown);
        console.log(installmentBreakdown);

        //Unique Services with Profit Loss
        const plBySiteWeek = await axios.get(`${API_BASE_URL}/api/profitloss/week-site`, {
          params: {
            site: selectedSite,
            serviceWeek: selectedWeek,
          }
        });
    
        //Week + site level Profit/Loss (total)
        setTotalPL(0);

        //Additional Charges
        let charges = [];
        weeklyInvoices.forEach((invoice) => {
          if(Array.isArray(invoice.additionalChargesDetail)) {
            charges.push(...invoice.additionalChargesDetail);
          }
        })
        setAddCharges(charges);
        const totalAdd = charges.reduce((sum, c) => sum + (c.type === "deduction" ? -Math.abs(c.rate) : Math.abs(c.rate)),0);
        setTotalAdd(totalAdd);
      }
      catch (error) {
        console.error("Error fetching weekly invoices:", error);
      }
    }

    const allPersonnels = useMemo(() => {
      const map = new Map();
      Object.values(personnelsByRole).forEach(personnelList => {
        personnelList.forEach(personnel => {
          map.set(personnel._id, personnel);
        });
      });
      return map;
    }, [personnelsByRole]);

    useEffect(() => {
      if(selectedWeek)
        fetchWeeklyInvoices();
    }, [selectedSite, selectedWeek, selectedRole]);

    const addProfitLoss = async (serviceName, site, week, profitLoss, revenue) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/profitloss`, {
                serviceName: serviceName,
                week: week,
                site: site,
                profitLoss: profitLoss,
                revenue: revenue,
                addedBy: JSON.stringify({ name: userDetails.firstName + userDetails.lastName, email: userDetails.email, role: userDetails.role, addedOn: new Date() })
            });
            const incentiveResponse = await axios.put(`${API_BASE_URL}/api/companyincentive`, {
              week: week,
              site: site,
              amount: incentiveAmt
            })
            fetchWeeklyInvoices();
        } catch (error) {
            console.error('Error adding New Profit Loss Entry:', error);
        }
    }

    const handleData = (serviceObject) => {
        var site = selectedSite ?? "";
        var week = selectedWeek ?? "";
        addProfitLoss(serviceObject.mainService, selectedSite, week, serviceObject.profitLoss, serviceObject.revenue);
    }

    //const handleAddAllRevenues = () => {
    //    const totalRevenue = filteredUniqueServices.reduce((sum, service) => {
    //        const revenue = parseFloat(service.revenue);
    //        return sum + (isNaN(revenue) ? 0 : revenue);
    //    }, 0);
    //
    //    const invoiceAmount = parseFloat(clientInvoiceAmt);
    //    const incentiveAmount = incentiveAmt ? parseFloat(incentiveAmt) : 0;
//
    //    console.log("Invoice Amount = ", invoiceAmount);
    //    console.log("Incentive Amount = ", incentiveAmount);
    //
    //    //const roundedInvoice = Math.round(invoiceAmount * 100);
    //    //const roundedTotal = Math.round(totalRevenue * 100);
    //
    //    if (invoiceAmount !== (totalRevenue + incentiveAmount)) {
    //        setToastOpen({
    //            content: <>
    //                <p className='text-sm font-bold text-red-500'>Individual service revenues entered and Incentive do not add up to total Client Invoice Amount specified.</p>
    //            </>
    //        })
    //        setTimeout(() => setToastOpen(null), 3000);
    //        return;
    //    }
    //
    //    // Proceed to call handleData for all services
    //    filteredUniqueServices.forEach(service => {
    //      if (service.revenue && parseFloat(service.revenue) > 0) {
    //        handleData(service);
    //      }
    //    });
    //    setToastOpen({
    //        content: <>
    //            <SuccessTick width={20} height={20} />
    //            <p className='text-sm font-bold text-green-500'>Profit / Loss entries added successfully</p>
    //        </>
    //    })
    //    setClientInvoiceAmt("");
    //    setIncentiveAmt("");
    //    setFilteredUniqueServices(prev =>
    //      prev.map(service => ({ ...service, revenue: "" }))
    //    );
    //    setTimeout(() => setToastOpen(null), 3000);
    //}; 

    return (
        <div className='w-full h-full flex flex-col items-center justify-center p-1.5 md:p-3 dark:text-white'>
            <div className={`${toastOpen ? 'opacity-100 translate-y-16' : 'opacity-0'} transition-all ease-in duration-200 border border-stone-200 fixed flex justify-center items-center z-50 backdrop-blur-sm top-4 left-1/2 -translate-x-1/2 bg-stone-400/20 dark:bg-dark/20 p-3 rounded-lg shadow-lg`}>
                <div className='flex gap-4 justify-around items-center'>
                    {toastOpen?.content}
                </div>
            </div>
            <div className='flex-1 flex flex-col w-full h-full overflow-hidden'>
              <div className='flex font-bold text-lg justify-between items-center z-5 w-full p-2 dark:text-white'>
                <div className='flex gap-1'>
                  Spending Insights
                </div>
              </div>
              <div className='flex-1 overflow-hidden'>
                <div className={`${selectedTab === "PL" ? "flex-1 flex flex-col h-full p-2 bg-white dark:bg-dark rounded-lg" : "hidden"}`}>
                    <div className={`grid grid-cols-2 p-3 gap-2 md:gap-5 bg-neutral-100/90 dark:bg-dark-2 shadow border-[1.5px] border-neutral-300/80 dark:border-dark-5 rounded-lg dark:!text-white mb-3`}>
                        <div className='flex flex-col gap-1'>
                            {userDetails?.role === "Operational Manager" ? (
                              <>
                                <label className="text-xs font-semibold">Select Site:</label>
                                <select
                                  className="dark:bg-dark-3 bg-white rounded-md border-[1.5px] border-neutral-300 px-12 py-3.5 outline-none focus:border-primary-200 dark:border-dark-5 disabled:border-gray-200 disabled:text-gray-500"
                                  value={selectedSite}
                                  onChange={(e) => setSelectedSite(e.target.value)}
                                >
                                  {userDetails.siteSelection.map((site) => (
                                    <option key={site} value={site}>
                                        {site}
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <>
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
                              </>
                            )}
                        </div>
                        <div className='flex flex-col gap-1'>
                            <label className='text-xs font-semibold'>Select Week:</label>
                            <WeekInput
                                value={selectedWeek}
                                onChange={(week) => {
                                    setSelectedWeek(week)
                                }}
                            />
                        </div>
                    </div>
                    <div className={`col-span-1 grid grid-cols-7 p-3 gap-2 md:gap-5 bg-neutral-100/90 dark:bg-dark-2 shadow border-[1.5px] border-neutral-300/80 dark:border-dark-5 rounded-lg dark:!text-white`}>
                                <InputWrapper title="Total Services">
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{totalServices}</p>
                                </InputWrapper>
                                <InputWrapper title="Total Expenses">
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{totalExp?.toFixed(2)}</p>
                                </InputWrapper>
                                <InputWrapper title="Total Profit/Loss">
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{totalPL?.toFixed(2)}</p>
                                </InputWrapper>
                                <InputWrapper title="Total Additional Charges">
                                    <p className="text-base font-medium text-gray-900 dark:text-white">{totalAdd?.toFixed(2)}</p>
                                </InputWrapper>
                    </div>
                    <div className={`grid grid-cols-4 flex-1 h-full py-3 gap-2 md:gap-5 overflow-hidden dark:!text-white`}>
                      <div className='col-span-1 flex flex-col h-full gap-3 overflow-hidden'>
                        <div className={`flex flex-col flex-1 h-full p-3 overflow-hidden gap-0 md:gap-0 bg-neutral-100/90 dark:bg-dark-2 shadow border-[1.5px] border-neutral-300/80 dark:border-dark-5 rounded-lg dark:!text-white`}>
                            <div className="flex w-full justify-center border-[1.5px] border-neutral-300/80 mb-1">Additional Charges Breakdown</div>
                            <div className='flex-1 overflow-auto border border-neutral-300 dark:border-dark-4 rounded-b-lg bg-white dark:bg-dark'>
                              {(
                                addCharges.length > 0 ? (
                                  <div className='p-2'>
                                    <table className="table-general overflow-auto">
                                      <thead>
                                        <tr className="bg-white dark:bg-dark border-b border-neutral-200 text-neutral-400">
                                          <th>Charge Title</th>
                                          <th>Charge Type</th>
                                          <th>Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {addCharges.map((charge, idx) => (
                                          <tr key={idx}>
                                            <td>{charge.title}</td>
                                            <td style={{ textTransform: 'capitalize' }}>{charge.type}</td>
                                            <td>{charge.type === "deduction" ? `-£${charge.rate?.toFixed(2)}` : `£${charge.rate?.toFixed(2)}`}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (<div className='p-2'>
                                    <div className='flex p-3 justify-center'>No Data</div>
                                    </div>
                                )
                              )}
                            </div>
                        </div>
                      </div>
                      <div className='flex flex-col col-span-3 h-full bg-white overflow-hidden dark:bg-dark dark:border-dark-3'>
                        <div className={`grid grid-cols-5 p-3 gap-2 md:gap-5 bg-neutral-100/90 dark:bg-dark-2 rounded-t-lg dark:!text-white`}>
                            <div className='flex flex-col gap-1'>
                                <label className="text-xs font-semibold">Client Invoice Amount:</label>
                                <input type="number" value={clientInvoiceAmt} className='dark:bg-dark-3 bg-white rounded-md border-[1.5px] border-neutral-300 dark:border-dark-5 px-2 py-1 h-8 md:h-10 outline-none focus:border-primary-200' onChange={(e) => setClientInvoiceAmt(e.target.value)} placeholder="Enter Value" />
                            </div>
                            <div className='flex flex-col gap-1'>
                                <label className='text-xs font-semibold'>Additional Amount:</label>
                                <input type="number" value={incentiveAmt} onChange={(e) => setIncentiveAmt(e.target.value)} className='dark:bg-dark-3 bg-white rounded-md border-[1.5px] border-neutral-300 dark:border-dark-5 px-2 py-1 h-8 md:h-10 outline-none focus:border-primary-200' placeholder="Enter Value" />
                            </div>
                            <button className='w-fit h-full self-end text-white bg-primary-500 hover:bg-primary-300  rounded-lg text-xs md:text-sm px-2 py-1 h-8 md:h-10' onClick={() => {console.log("Adding Revenues")}}>Add Revenues</button>
                            <div></div>
                        </div>
                        <div className='flex-grow overflow-y-auto p-2 border border-neutral-300 shadow rounded-b-lg'>
                          {weeklyInvoices.length == 0 &&
                            <h3 className='flex p-3 justify-center'>No Data</h3>
                          }
                          { weeklyInvoices.length > 0 &&
                            <table className='table-general overflow-auto'>
                                <thead>
                                    <tr className="sticky -top-2 z-3 bg-white dark:bg-dark dark:border-dark-3 border-b border-neutral-200 dark:text-white text-neutral-400">
                                        <th>#</th>
                                        <th>Count</th>
                                        <th>Expenses</th>
                                        <th>Client Invoice Amount (£)</th>
                                        <th>Profit / Loss</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {weeklyInvoices.map((invoice, index) => {
                                        return (
                                            <tr key={index}>
                                                <td>{index + 1}</td>
                                                <td>{invoice.invoices.length}</td>
                                                <td>£ {invoice?.total?.toFixed(2)}</td>
                                                <td className='p-0'>
                                                    <input
                                                        type="number"
                                                        value={invoice?.revenue}
                                                        onChange={(e) => { console.log("Trying to change value") }}
                                                        className="dark:bg-dark-3 bg-white rounded-md border-[1.5px] border-neutral-300 dark:border-dark-5 px-2 py-1 h-8 md:h-10 outline-none focus:border-primary-200"
                                                        placeholder="Enter Revenue"
                                                    />
                                                </td>
                                                <td>{invoice?.profitLoss?.toFixed?.(2) ?? "Enter Revenue"}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                          }
                        </div>
                        <div className='flex-shrink-0 mt-3 border border-neutral-300 shadow rounded-lg bg-white dark:bg-dark dark:border-dark-3'>
                        </div>
                      </div>
                    </div>
                </div>
               </div> 
            </div>
        </div>
    );
};

export default SpendingInsights;