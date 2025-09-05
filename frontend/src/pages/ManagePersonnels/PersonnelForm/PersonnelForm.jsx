import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import PersonnelInfoTab from './PersonnelInfoTab';
import BankDetails from './BankDetails';
import DrivingLicenseTab from './DrivingLicenseTab';
import PassportTab from './PassportTab';
import RightToWorkTab from './RightToWorkTab';
import ECSTab from './ECSTab';
import DocumentsTab from './DocumentsTab';
import SelfEmploymentDetails from './SelfEmploymentDetails';
import SuccessTick from '../../../components/UIElements/SuccessTick';
import { addPersonnel, updatePersonnel } from '../../../features/personnels/personnelSlice';
import moment from 'moment'

const API_BASE_URL = import.meta.env.VITE_API_URL;

const PersonnelForm = ({ clearPersonnel, userDetails, newPersonnel, setNewPersonnel, sites, personnelMode, setPersonnelMode, setToastOpen, personnelsList, roles }) => {
    const dispatch = useDispatch();

    const [errors, setErrors] = useState({});
    const [age, setAge] = useState(null);
    const [selectedTab, setSelectedTab] = useState('personnelInfo');
    const [success, setSuccess] = useState(false);

    let tabsInfo = [
        { id: 'personnelInfo', label: 'Personnel Info', component: PersonnelInfoTab },
        { id: 'bankDetails', label: 'Bank Details', component: BankDetails },
        { id: 'drivingLicense', label: 'Driving License', component: DrivingLicenseTab },
        { id: 'passport', label: 'Passport', component: PassportTab },
        { id: 'rightToWork', label: 'Right to Work', component: RightToWorkTab },
        { id: 'ecs', label: 'ECS', component: ECSTab },
        { id: 'documents', label: 'Documents', component: DocumentsTab },
    ];

    const [tabs, setTabs] = useState(tabsInfo);

    const requiredFields = {
        personnelInfo: [
            'firstName',
            'lastName',
            'dateOfBirth',
            'postcode',
            'nationality',
            'nationalInsuranceNumber',
            'phone',
            'email',
            'siteSelection',
            ...(newPersonnel?.vatDetails?.vatNo ? ['vatDetails.vatEffectiveDate'] : [])
        ],
        bankDetails: [
            'bankDetails.bankName',
            'bankDetails.sortCode',
            'bankDetails.accNo',
            'bankDetails.accName'
        ],
        drivingLicense: [
            'drivingLicenseDetails.dlNumber',
            'drivingLicenseDetails.dlValidity',
            'drivingLicenseDetails.dlExpiry'
        ],
        passport: [
            'passportDetails.issuedFrom',
            'passportDetails.passportNumber',
            'passportDetails.passportValidity',
            'passportDetails.passportExpiry'
        ],
        rightToWork: (newPersonnel?.passportDetails?.issuedFrom !== 'United Kingdom')
            ? ['rightToWorkDetails.rightToWorkValidity', 'rightToWorkDetails.rightToWorkExpiry']
            : [],
        ecs: (newPersonnel?.ecsDetails?.active)
            ? ['ecsDetails.ecsIssue', 'ecsDetails.ecsExpiry']
            : [],
        selfEmploymentDetails: newPersonnel.employmentStatus === 'Limited Company' ? [
            'companyName',
            'companyRegAddress',
            'companyRegNo',
            'companyRegExpiry',
            ...(newPersonnel.companyVatDetails && newPersonnel.companyVatDetails?.vatNo !== '' ? ['companyVatDetails.vatEffectiveDate'] : [])

        ] : []
    };

    const fileFields = [
        'profilePicture',
        'ninoDocument',
        'signature',
        'drivingLicenseFrontImage',
        'drivingLicenseBackImage',
        'passportDocument',
        'ecsCard',
        'rightToWorkCard',
        'companyRegistrationCertificate',
        'MotorVehicleInsuranceCertificate',
        'GoodsInTransitInsurance',
        'PublicLiablity',
        'insuranceDocument'
    ];

    const objectFields = [
        'vatDetails',
        'companyVatDetails',
        'bankDetails',
        'drivingLicenseDetails',
        'passportDetails',
        'rightToWorkDetails',
        'ecsDetails'
    ];

    // Helper function to convert affectedInvoices to CSV
    const convertToCSV = (type, invoices) => {
        const headers = ['Personnel Name', `${type === 'WeeklyInvoice' ? 'Week' : 'Date'}`];
        const rows = invoices.map((invoice) => [
            `"${invoice.personnelName}"`, // Wrap in quotes to handle commas or special characters
            `${type === 'WeeklyInvoice' ? moment(invoice.serviceWeek).format('GGGG-[W]WW') : moment(invoice.date).format('DD/MM/YYYY')}`,
        ]);
        return [
            headers.join(','),
            ...rows.map((row) => row.join(',')),
        ].join('\n');
    };

    // Helper function to trigger CSV download
    const downloadCSV = (type, invoices, filename = `affected_${type === 'WeeklyInvoice' ? 'weekly' : 'daily'}_invoices.csv`) => {
        const csvContent = convertToCSV(type, invoices);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const validateFields = () => {
      const newErrors = {};
      const currentTabFields = requiredFields[selectedTab] || [];

      // Requireds by path
      currentTabFields.forEach((path) => {
        const value = getByPath(newPersonnel, path);
        if (typeof value === 'string' ? value.trim() === '' : !value) {
          newErrors[path] = true; // key by path string
        }
      });

      // Email format + duplicate (always key 'email')
      if (selectedTab === 'personnelInfo') {
        const email = newPersonnel?.email ?? '';
        if (email && !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
          newErrors['email'] = 'Enter a valid email';
        } else if (
          email &&
          personnelMode === 'create' &&
          personnelsList.some((p) => p.email === email)
        ) {
          newErrors['email'] = 'Email already exists';
        }

        // Site selection for OSM
        if (newPersonnel.role === 'On-Site Manager' && newPersonnel.siteSelection.length !== 1) {
            newErrors['siteSelectionOsm'] = true;
        }
      }

      // Sort code format (bankDetails.sortCode)
      if (selectedTab === 'bankDetails') {
        const sortCode = newPersonnel?.bankDetails?.sortCode ?? '';
        if (sortCode && !/^[0-9]{6}$/.test(sortCode)) {
          newErrors['bankDetails.sortCode'] = true;
        }
      }

      setErrors(newErrors);

      const firstErrorField = Object.keys(newErrors)[0];
      if (firstErrorField) {
        const el = document.querySelector(`[name="${firstErrorField}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
      return true;
    };

    const validateAllFields = () => {
      const newErrors = {};

      Object.keys(requiredFields).forEach((tabId) => {
        (requiredFields[tabId] || []).forEach((path) => {
          const value = getByPath(newPersonnel, path);
          if (typeof value === 'string' ? value.trim() === '' : !value) {
            newErrors[path] = true; // key by path
          }
        });
      });

      // Email format + duplicate
      const email = newPersonnel?.email ?? '';
      if (email && !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
        newErrors['email'] = 'Enter a valid email';
      } else if (
        email &&
        personnelMode === 'create' &&
        personnelsList.some((p) => p.email === email)
      ) {
        newErrors['email'] = 'Email already exists';
      }

      // OSM site selection restriction
      if (newPersonnel.role === 'On-Site Manager' && newPersonnel.siteSelection.length !== 1) {
          newErrors['siteSelectionOsm'] = true;
      }

      // Sort code format
      const sortCode = newPersonnel?.bankDetails?.sortCode ?? '';
      if (sortCode && !/^[0-9]{6}$/.test(sortCode)) {
        newErrors['bankDetails.sortCode'] = true;
      }

      setErrors(newErrors);

      const firstErrorField = Object.keys(newErrors)[0];
      if (firstErrorField) {
        const el = document.querySelector(`[name="${firstErrorField}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
      }
      return true;
    };

    //const onInputChange = (e, inputValue, inputName) => {
    //    let name, value;
//
    //    if (e) {
    //        if (e.target.type === 'checkbox') {
    //            value = e.target.checked;
    //            name = e.target.name;
    //        } else if (e.target.type === 'file') {
    //            value = e.target.files[0] || '';
    //            name = e.target.name;
    //        } else {
    //            value = e.target.value;
    //            name = e.target.name;
    //        }
    //    } else {
    //        name = inputName;
    //        value = inputValue;
    //    }
//
    //    setErrors((prevErrors) => ({ ...prevErrors, [name]: false }));
    //    setNewPersonnel((prev) => ({ ...prev, [name]: value }));
    //};

    // Helper: immutable "set by path" with dot & bracket notation support
    const setByPath = (obj, path, value) => {
      const keys = path
        .replace(/\[(\d+)\]/g, ".$1") // allow e.g. items[0].name
        .split(".")
        .filter(Boolean);
    
      // Start with a shallow clone of the root
      const newObj = Array.isArray(obj) ? [...obj] : { ...obj };
    
      let curr = newObj;
      let src = obj;
    
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        const nextSrc = src?.[k];
        const nextIsIndex = /^\d+$/.test(keys[i + 1]);
    
        // Clone existing branch or create one
        const next =
          nextIsIndex
            ? (Array.isArray(nextSrc) ? [...nextSrc] : [])
            : (nextSrc && typeof nextSrc === "object" ? { ...nextSrc } : {});
    
        curr[k] = next;
        curr = next;
        src = nextSrc;
      }
  
      curr[keys[keys.length - 1]] = value;
      return newObj;
    };

    const getByPath = (obj, path) => {
        const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
        return keys.reduce((acc, k) => (acc?.[k] ?? undefined), obj);
    };

    useEffect(() => {
        let updatedTabs = [...tabsInfo];

        // Add or remove Self Employment Details tab based on employment status
        if (newPersonnel.employmentStatus === 'Limited Company') {
            if (!updatedTabs.some(tab => tab.id === 'selfEmploymentDetails')) {
                updatedTabs.splice(1, 0, { id: 'selfEmploymentDetails', label: 'Self Employment Details', component: SelfEmploymentDetails });
            }
        } else {
            updatedTabs = updatedTabs.filter(tab => tab.id !== 'selfEmploymentDetails');
        }
        setTabs(updatedTabs);
    }, [newPersonnel.employmentStatus]);
    
    const onInputChange = (e, inputValue, inputName) => {
      let name, value;
    
      if (e && e.target) {
        const { target } = e;
        name = target.name;
        if (target.type === "checkbox") value = target.checked;
        else if (target.type === "file") value = target.files?.[0] ?? "";
        else value = target.value;
      } else {
        name = inputName;
        value = inputValue;
      }
  
      // You can keep errors flat keyed by the path string
      setErrors((prev) => ({ ...prev, [name]: false }));
  
      // Use setByPath to update nested state immutably
      setNewPersonnel((prev) => setByPath(prev, name, value));
    };

    const handleSubmit = async (e, personnelMode) => {
        e.preventDefault();

        if (!validateAllFields()) {
            // Find the first tab with errors
            for (const tab of tabs) {
                const tabHasError = requiredFields[tab.id]?.some(field => errors[field]);
                if (tabHasError) {
                    setSelectedTab(tab.id);
                    break;
                }
            }
            return;
        }

        // Create FormData object
        const formData = new FormData();

        // Append all non-file fields
        Object.keys(newPersonnel).forEach(key => {
            if (!fileFields.includes(key) && !objectFields.includes(key)) {
                formData.append(key, newPersonnel[key] !== undefined && newPersonnel[key] !== null ? newPersonnel[key].toString() : '');
            }
        });

        // Append file fields
        fileFields.forEach(key => {
            if (newPersonnel[key] instanceof File) {
                formData.append(key, newPersonnel[key]);
            }
        });

        objectFields.forEach((key) => {
          formData.append(key, JSON.stringify(newPersonnel[key] ?? {}));
        });

        if (personnelMode === 'create') {
            let userID = 0;
            try {
                const response = await axios.get(`${API_BASE_URL}/api/idcounter/Personnel`);
                userID = response.data[0].counterValue;
            } catch (error) {
                console.error('Error Fetching ID Counter', error.response ? error.response.data : error.message);
            }
            const formattedUserID = userID.toString().padStart(6, '0');
            formData.append('user_ID', formattedUserID);
            formData.append('addedBy', JSON.stringify({ name: userDetails.firstName + userDetails.lastName, email: userDetails.email, role: userDetails.role, addedOn: new Date() }));
            formData.append('companyId', userDetails.companyId)
            const counterUpdate = await axios.put(`${API_BASE_URL}/api/idcounter/Personnel`, {});
            try {
                const response = await dispatch(addPersonnel(formData)).unwrap();;
                setPersonnelMode('view');
                setToastOpen({
                    content: <>
                        <SuccessTick width={17} height={17} />
                        <p className='text-sm font-bold text-green-600'>Personnel Added Successfully</p>
                    </>
                })
                setTimeout(() => {
                    setToastOpen(null)
                }, 2000);
                setNewPersonnel(clearPersonnel)
            } catch (error) {
                console.log(error)
                const errorMessage =
                    error?.response?.data?.message || error?.message || "Unexpected error occurred.";
                setToastOpen({
                    content: <>
                        <p className='flex gap-1 text-sm font-bold text-red-600'><i class="flex items-center fi fi-ss-triangle-warning"></i>{errorMessage}</p>
                    </>
                })
                setTimeout(() => setToastOpen(null), 3000);
            }
        }
        else if (personnelMode === 'edit') {
            try {
                await dispatch(updatePersonnel(formData)).unwrap();
                setPersonnelMode('view');
                setToastOpen({
                    content: <>
                        <SuccessTick width={17} height={17} />
                        <p className='text-sm font-bold text-green-600'>Personnel Updated Successfully</p>
                    </>
                })
                setTimeout(() => {
                    setToastOpen(null)
                }, 2000);
                setNewPersonnel(clearPersonnel)
            } catch (error) {
                console.log(error)
                setPersonnelMode('view');
                setNewPersonnel(clearPersonnel)
                setToastOpen({
                    content: <>
                        <div className='flex gap-3 items-center'>
                            <p className='flex gap-1 text-sm font-bold text-red-600 whitespace-nowrap'><i class="flex items-center fi fi-ss-triangle-warning"></i>{error?.response?.data?.message}</p>
                            <div className="flex gap-2 mt-2">
                                <button
                                    className="px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 text-xs whitespace-nowrap"
                                    onClick={() => downloadCSV(error?.response?.data?.type, error?.response?.data?.negativeInvoices)}
                                >
                                    Download CSV
                                </button>
                                <button
                                    className="px-2 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-xs"
                                    onClick={() => setToastOpen(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </>
                })
            }
        }
    };

    const SelectedTabComponent = tabs.find(tab => tab.id === selectedTab)?.component;

    if (success) {
        return (
            <div className='flex flex-col h-full w-full items-center justify-center align-center'>
                <SuccessTick width='5rem' height='5rem' />
                <p className='flex mt-8 justify-center w-full text-green font-bold'>Personnel added successfully</p>
            </div>
        );
    }

    return (
        <div className='flex flex-col flex-1 overflow-auto'>

            <div className='flex-1 p-2'>
                {/* Tabs Navigation */}
                <div className='flex justify-between overflow-x-auto snap-x snap-mandatory scrollbar-hide h-12 bg-primary-200/30 py-1 rounded-t-lg backdrop-blur-xl border border-primary-500'>
                    {tabs.map((tab, index) => (
                        <div
                            key={tab.id}
                            className={`flex justify-center m-1 w-full min-w-max dark:text-white snap-start ${index !== tabs.filter((tab) => !['Admin', 'super-admin'].includes(userDetails.role) ? tab.id !== 'bankDetails' : true).length - 1 ? 'border-r-2 border-primary-400' : ''}`}
                        >
                            <button
                                className={`${selectedTab === tab.id
                                    ? 'bg-white border-1 border-primary-400 shadow-lg dark:bg-primary-400'
                                    : 'hover:bg-primary-400/30 hover:rounded-md'
                                    } text-xs px-4 rounded-md transition mx-3`}
                                onClick={() => setSelectedTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Tab Content */}
                <div className='flex-1 border-b border-x border-primary-300 rounded-b-lg'>
                    <SelectedTabComponent
                        newPersonnel={newPersonnel}
                        setNewPersonnel={setNewPersonnel}
                        onInputChange={onInputChange}
                        userDetails={userDetails}
                        errors={errors}
                        personnelMode={personnelMode}
                        setErrors={setErrors}
                        age={age}
                        setAge={setAge}
                        sites={sites}
                        roles={roles}
                    />
                </div>
            </div>

            {/* Form Actions */}
            <div className='sticky bottom-0 bg-white flex justify-end items-center z-5 p-3 border-t border-neutral-200 rounded-b-xl'>
                <div className='flex gap-3 text-sm'>
                    {!['Head of Operations', 'Operational Manager'].includes(userDetails.role) && <>  <button
                        onClick={() => {
                            if (validateFields()) {
                                // Find the next tab that's not the current one
                                const currentIndex = tabs.findIndex(tab => tab.id === selectedTab);
                                if (currentIndex < tabs.length - 1) {
                                    setSelectedTab(tabs[currentIndex + 1].id);
                                }
                            }
                        }}
                        className='bg-blue-500 rounded-md px-2 py-1 text-white'
                    >
                        Next
                    </button>
                        <button
                            onClick={(e) => handleSubmit(e, personnelMode)}
                            className='bg-green-500 rounded-md px-2 py-1 text-white'
                        >
                            {personnelMode === 'create' ? 'Add Personnel' : 'Update Personnel'}
                        </button></>}
                    <button
                        onClick={() => { setPersonnelMode('view'); setNewPersonnel(clearPersonnel); }}
                        className='bg-red-500 rounded-md px-2 py-1 text-white'
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PersonnelForm;