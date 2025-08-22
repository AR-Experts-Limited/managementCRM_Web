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
import SuccessTick from '../../../components/UIElements/SuccessTick';
import { addPersonnel, updatePersonnel } from '../../../features/personnels/personnelSlice';
import moment from 'moment'

const API_BASE_URL = import.meta.env.VITE_API_URL;

const PersonnelForm = ({ clearPersonnel, userDetails, newPersonnel, setNewPersonnel, sites, personnelMode, setPersonnelMode, setToastOpen, personnelsList }) => {
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
            ...(newPersonnel.vatDetails && newPersonnel.vatDetails?.vatNo !== '' ? ['vatEffectiveDate'] : [])
        ],
        bankDetails: newPersonnel.bankChoice === 'Personal' ? [
            'bankName',
            'sortCode',
            'bankAccountNumber',
            'accountName'
        ] : [
            'bankNameCompany',
            'sortCodeCompany',
            'bankAccountNumberCompany',
            'accountNameCompany'
        ],
        drivingLicense: [
            'drivingLicenseNumber',
            'dlValidity',
            'dlExpiry'
        ],
        passport: [
            'passportIssuedFrom',
            'passportNumber',
            'passportValidity',
            'passportExpiry'
        ],
        rightToWork: newPersonnel.passportIssuedFrom !== "United Kingdom" ? [
            'rightToWorkValidity',
            'rightToWorkExpiry'
        ] : [],
        ecs: newPersonnel.ecsInformation ? [
            'ecsValidity',
            'ecsExpiry'
        ] : [],
        vehicleInsuranceDetails: newPersonnel.typeOfPersonnel === 'Own Vehicle' ? [
            ...(!newPersonnel.ownVehicleInsuranceNA?.mvi ? [
                'insuranceProvider',
                'policyNumber',
                'policyStartDate',
                'policyEndDate',
            ] : []),
            ...(!newPersonnel.ownVehicleInsuranceNA?.goods ? [
                'insuranceProviderG',
                'policyNumberG',
                'policyStartDateG',
                'policyEndDateG',
            ] : []),
            ...(!newPersonnel.ownVehicleInsuranceNA?.public ? [
                'insuranceProviderP',
                'policyNumberP',
                'policyStartDateP',
                'policyEndDateP',
            ] : [])
        ] : [],
        selfEmploymentDetails: newPersonnel.employmentStatus === 'Limited Company' && newPersonnel.typeOfPersonnel === 'Company Vehicle' ? [
            'companyName',
            'companyRegAddress',
            'companyRegNo',
            'companyRegExpiry',
            ...(newPersonnel.companyVatDetails && newPersonnel.companyVatDetails?.companyVatNo !== '' ? ['companyVatEffectiveDate'] : [])

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
        "ownVehicleInsuranceNA",
        "vatDetails",
        "companyVatDetails",
        "customTypeOfPersonnel",
        "typeOfPersonnelTrace",
        "siteTrace"
    ]

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

        currentTabFields.forEach((key) => {
            if (key === 'Email') {
                if (!/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(newPersonnel.Email)) {
                    newErrors.Email = "Enter a valid email";

                }
                else if (personnelMode === 'create' && personnelsList.some((personnel) => personnel.Email === newPersonnel.Email)) {
                    newErrors.Email = "Email already exists";
                }
            }
            else if (key === 'vatEffectiveDate') {
                if (!newPersonnel.vatDetails?.vatEffectiveDate) {
                    newErrors.vatEffectiveDate = true;
                }
            }
            else if (key === 'companyVatEffectiveDate') {
                if (!newPersonnel.companyVatDetails?.companyVatEffectiveDate) {
                    newErrors.companyVatEffectiveDate = true;
                }

            } else {
                const value = newPersonnel[key];
                if (typeof value === 'string' ? value.trim() === '' : !value) {
                    newErrors[key] = true;
                }
            }
        });


        // Validate email format
        if (selectedTab === 'personnelInfo' && newPersonnel.Email && !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(newPersonnel.Email)) {
            newErrors.Email = true;
        }

        if (selectedTab === 'personnelInfo' && newPersonnel.vatDetails?.vatNo !== '' && newPersonnel.vatDetails?.vatEffectiveDate === '') {
            newErrors.vatEffectiveDate = true
        }

        if (selectedTab === 'selfEmploymentDetails' && newPersonnel.companyVatDetails?.companyVatNo !== '' && newPersonnel.companyVatDetails?.companyVatEffectiveDate === '') {
            newErrors.companyVatEffectiveDate = true
        }

        // Validate sort code format
        if (selectedTab === 'bankDetails') {
            const sortCodeRegex = /^[0-9]{6}$/;
            if (newPersonnel.bankChoice === 'Personal' && newPersonnel.sortCode && !sortCodeRegex.test(newPersonnel.sortCode)) {
                newErrors.sortCode = true;
            }
            if (newPersonnel.bankChoice === 'Company' && newPersonnel.sortCodeCompany && !sortCodeRegex.test(newPersonnel.sortCodeCompany)) {
                newErrors.sortCodeCompany = true;
            }
        }

        setErrors(newErrors);

        // Scroll to the first error input
        const firstErrorField = Object.keys(newErrors)[0];
        if (firstErrorField) {
            const element = document.querySelector(`[name="${firstErrorField}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }

        return Object.keys(newErrors).length === 0;
    };

    const validateAllFields = () => {
        const newErrors = {};

        Object.keys(requiredFields).forEach(tab => {
            requiredFields[tab].forEach((key) => {
                if (key === 'vatEffectiveDate') {
                    if (!newPersonnel.vatDetails?.vatEffectiveDate) {
                        newErrors.vatEffectiveDate = true;
                    }
                }
                else if (key === 'companyVatEffectiveDate') {
                    if (!newPersonnel.companyVatDetails?.companyVatEffectiveDate) {
                        newErrors.companyVatEffectiveDate = true;
                    }

                } else {
                    const value = newPersonnel[key];
                    if (typeof value === 'string' ? value.trim() === '' : !value) {
                        newErrors[key] = true;
                    }
                }
            });
        });

        // Validate email format
        if (newPersonnel.Email && !/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(newPersonnel.Email)) {
            newErrors.Email = "Enter a valid email";

        }
        else if (newPersonnel.Email && personnelMode === 'create' && personnelsList.some((personnel) => personnel.Email === newPersonnel.Email)) {
            newErrors.Email = "Email already exists";
        }

        // Validate sort code format
        const sortCodeRegex = /^[0-9]{6}$/;
        if (newPersonnel.bankChoice === 'Personal' && newPersonnel.sortCode && !sortCodeRegex.test(newPersonnel.sortCode)) {
            newErrors.sortCode = true;
        }
        if (newPersonnel.bankChoice === 'Company' && newPersonnel.sortCodeCompany && !sortCodeRegex.test(newPersonnel.sortCodeCompany)) {
            newErrors.sortCodeCompany = true;
        }

        setErrors(newErrors);
        // Scroll to the first error input
        const firstErrorField = Object.keys(newErrors)[0];
        if (firstErrorField) {
            const element = document.querySelector(`[name="${firstErrorField}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
        }

        return Object.keys(newErrors).length === 0;
    };

    const onInputChange = (e, inputValue, inputName) => {
        let name, value;

        if (e) {
            if (e.target.type === 'checkbox') {
                value = e.target.checked;
                name = e.target.name;
            } else if (e.target.type === 'file') {
                value = e.target.files[0] || '';
                name = e.target.name;
            } else {
                value = e.target.value;
                name = e.target.name;
            }
        } else {
            name = inputName;
            value = inputValue;
        }

        setErrors((prevErrors) => ({ ...prevErrors, [name]: false }));
        setNewPersonnel((prev) => ({ ...prev, [name]: value }));
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

        // Append ownVehicleInsuranceNA state
        if (newPersonnel.typeOfPersonnel === 'Own Vehicle') {
            formData.append('ownVehicleInsuranceNA', JSON.stringify(newPersonnel.ownVehicleInsuranceNA));
        }
        else if (newPersonnel.typeOfPersonnel === 'Company Vehicle' && newPersonnel.employmentStatus === 'Limited Company')
            formData.append('companyVatDetails', JSON.stringify(newPersonnel.companyVatDetails));

        formData.append('vatDetails', JSON.stringify(newPersonnel.vatDetails));
        formData.append(
            'customTypeOfPersonnel',
            newPersonnel.customTypeOfPersonnel ? JSON.stringify(newPersonnel.customTypeOfPersonnel) : null
        );

        formData.append(
            'typeOfPersonnelTrace',
            newPersonnel.typeOfPersonnelTrace ? JSON.stringify(newPersonnel.typeOfPersonnelTrace) : []
        );

        formData.append(
            'siteTrace',
            newPersonnel.siteTrace ? JSON.stringify(newPersonnel.siteTrace) : []
        );


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
                    {tabs.filter((tab) => !['Admin', 'super-admin'].includes(userDetails.role) ? tab.id !== 'bankDetails' : true).map((tab, index) => (
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