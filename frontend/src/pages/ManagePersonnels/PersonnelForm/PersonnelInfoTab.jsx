import React, { useRef, useState, useEffect } from 'react';
import InputGroup from '../../../components/InputGroup/InputGroup';
import DatePicker from '../../../components/Datepicker/Datepicker';
import { FaHouseUser, FaUser, FaEnvelope, FaIdCard, FaGlobe, FaCar, FaPhone, FaTruck } from 'react-icons/fa';
import { FaBuildingUser } from "react-icons/fa6";
import { GoNumber } from 'react-icons/go';
import countries from '../../../lib/countries';
import { FcInfo } from 'react-icons/fc';
import Nationality from '../../../lib/Nationality';

const PersonnelInfoTab = ({ sites, userDetails, newPersonnel, setNewPersonnel, onInputChange, errors, setErrors, age, setAge, personnelMode }) => {
    const initialTypeOfPersonnel = useRef()
    const initialSite = useRef()

    useEffect(() => {
        let calculatedAge = null
        if (newPersonnel?.dateOfBirth) {
            const birthDate = new Date(newPersonnel?.dateOfBirth);
            const today = new Date();

            calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const hasBirthdayPassed =
                today.getMonth() > birthDate.getMonth() ||
                (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

            if (!hasBirthdayPassed) {
                calculatedAge--;
            }
        }
        setAge(calculatedAge);
    }, [newPersonnel.dateOfBirth])

    useEffect(() => {
        if (!initialTypeOfPersonnel.current) {
            initialTypeOfPersonnel.current = newPersonnel.typeOfPersonnel; // shallow copy
        }

        if (!initialSite.current) {
            initialSite.current = newPersonnel.siteSelection
        }
    }, []);

    const handleVatDetailsChange = (name, value) => {
        setNewPersonnel(prev => {
            let updatedVatDetails = { ...prev.vatDetails, [name]: value };

            // If vatNo is cleared, also clear vatEffectiveDate
            if (name === "vatNo" && !value) {
                updatedVatDetails.vatEffectiveDate = "";
            }

            return {
                ...prev,
                vatDetails: updatedVatDetails
            };
        });

        setErrors(prevErrors => ({
            ...prevErrors,
            [name]: false
        }));
    };

    const setCustomTypeOfPersonnel = (customTypeOfPersonnel) => {
        setNewPersonnel(prev => ({
            ...prev,
            customTypeOfPersonnel
        }));
    }

    const handleChangeOfTypeOfPersonnel = (e) => {
        const nextType = e.target.value;
        const tomorrow = new Date(Date.now()).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        }).split('/').join('/');

        let updatedTypeOfPersonnelTrace = [...(newPersonnel.typeOfPersonnelTrace || [])];

        // Only proceed if the initial type isn't empty
        if (initialTypeOfPersonnel.current !== '') {
            if (nextType !== initialTypeOfPersonnel.current) {
                const existingIndex = updatedTypeOfPersonnelTrace.findIndex(trace => trace.timestamp === tomorrow);

                const newTrace = {
                    from: newPersonnel.typeOfPersonnel,
                    to: nextType,
                    timestamp: tomorrow
                };

                if (existingIndex !== -1) {
                    // Replace existing trace with same timestamp
                    updatedTypeOfPersonnelTrace[existingIndex] = newTrace;
                } else {
                    // Push new trace
                    updatedTypeOfPersonnelTrace.push(newTrace);
                }
            }
            else {
                updatedTypeOfPersonnelTrace.pop()
            }
        }

        setNewPersonnel(prev => ({
            ...prev,
            typeOfPersonnel: nextType,
            typeOfPersonnelTrace: updatedTypeOfPersonnelTrace
        }));
    };

    const handleChangeOfSite = (e) => {
        const nextSite = e.target.value;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        let updatedSiteTrace = [...(newPersonnel.siteTrace || [])];

        // Only proceed if the initial site isn't empty
        if (initialSite.current !== '') {
            if (nextSite !== initialSite.current) {
                const existingIndex = updatedSiteTrace.findIndex(trace =>
                    new Date(trace.timestamp).getTime() === today.getTime()
                );

                const newTrace = {
                    from: newPersonnel.siteSelection,
                    to: nextSite,
                    timestamp: today
                };

                if (existingIndex !== -1) {
                    const existingTrace = updatedSiteTrace[existingIndex];

                    // Check if from === to after update
                    if (existingTrace.from === nextSite) {
                        // ❌ from and to are same → remove trace
                        updatedSiteTrace.splice(existingIndex, 1);
                    } else {
                        // ✅ Replace with new trace
                        updatedSiteTrace[existingIndex] = {
                            from: existingTrace.from,
                            to: nextSite,
                            timestamp: today
                        };
                    }
                } else {
                    // Push new trace
                    updatedSiteTrace.push(newTrace);
                }
            } else {
                updatedSiteTrace.pop();
            }
        }

        setNewPersonnel(prev => ({
            ...prev,
            siteSelection: nextSite,
            siteTrace: updatedSiteTrace
        }));
    };


    return (

        <div className='p-6'>
            {console.log('newPersonnel:', newPersonnel)}
            <h1 className='text-center font-bold'>Personnel Information</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5">
                {/* First Name */}
                <div>
                    <InputGroup
                        label="First Name"
                        placeholder="Enter first name"
                        type="text"
                        value={newPersonnel?.firstName}
                        name='firstName'
                        iconPosition="left"
                        onChange={(e) => onInputChange(e)}
                        required={true}
                        icon={<FaUser className='text-neutral-300' />}
                        error={errors.firstName}
                    />
                    <p className={`${errors.firstName ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide first name</p>
                </div>

                {/* Last Name */}
                <div>
                    <InputGroup
                        label="Last Name"
                        placeholder="Enter last name"
                        type="text"
                        name="lastName"
                        value={newPersonnel.lastName}
                        onChange={(e) => onInputChange(e)}
                        required={true}
                        iconPosition="left"
                        icon={<FaUser className='text-neutral-300' />}
                        error={errors.lastName}
                    />
                    <p className={`${errors.lastName ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide last name</p>
                </div>

                {/* Address */}
                <div>
                    <InputGroup
                        label="Address"
                        placeholder="Enter address"
                        type="text"
                        name="address"
                        error={errors.address}
                        value={newPersonnel.address}
                        iconPosition="left"
                        icon={<FaHouseUser className='text-neutral-300' />}
                        onChange={(e) => onInputChange(e)}
                    />
                    <p className={`${errors.address ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid address</p>
                </div>

                {/* Post Code */}
                <div>
                    <InputGroup
                        label="Postal Code"
                        placeholder="Enter postal code"
                        type="text"
                        name="postcode"
                        error={errors.postcode}
                        value={newPersonnel.postcode}
                        iconPosition="left"
                        icon={<FaHouseUser className='text-neutral-300' />}
                        onChange={(e) => onInputChange(e)}
                    />
                    <p className={`${errors.postcode ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid postal code</p>
                </div>

                {/* Date of Birth */}
                <div className='relative'>
                    <DatePicker
                        label="Date of Birth"
                        required={true}
                        value={newPersonnel?.dateOfBirth ? new Date(newPersonnel?.dateOfBirth) : ''}
                        name="dateOfBirth"
                        iconPosition="left"
                        error={errors.dateOfBirth}
                        maxDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}

                        onChange={(value) =>
                            onInputChange(null, value, "dateOfBirth")
                        }
                    />
                    {age !== null && <div className='absolute top-[38%] right-3 text-xs bg-stone-100 border border-stone-200  rounded-md p-2'>Age: {age}</div>}
                    <p className={`${errors.dateOfBirth ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide date of birth</p>
                </div>

                {/* Nationality */}
                <div>
                    <InputGroup type='dropdown'
                        name='nationality'
                        label='Nationality'
                        className={`${newPersonnel.nationality === '' && 'text-gray-400'}`}
                        value={newPersonnel.nationality}
                        onChange={(e) => onInputChange(e)}
                        error={errors.nationality}
                        iconPosition="left"
                        icon={<FaGlobe className='text-neutral-300' />}
                        required={true}>
                        <option disabled value="">Select Nationality</option>
                        {Object.values(Nationality).map((nationality, index) => (
                            <option key={index} value={nationality}>
                                {nationality}
                            </option>
                        ))}
                    </InputGroup>
                    <p className={`${errors.nationality ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide nationality</p>
                </div>

                {/* National Insurance Number */}
                <div>
                    <InputGroup
                        label="National Insurance Number"
                        placeholder="Enter NIN"
                        type="text"
                        required={true}
                        name="nationalInsuranceNumber"
                        error={errors.nationalInsuranceNumber}
                        iconPosition="left"
                        icon={<FaIdCard className='text-neutral-300' />}
                        value={newPersonnel.nationalInsuranceNumber}
                        onChange={(e) => { if (e.target.value.length <= 9) onInputChange(e) }}
                    />
                    <p className={`${errors.nationalInsuranceNumber ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid NI number</p>
                </div>

                {/* Phone Number */}
                <div>
                    <InputGroup
                        label="Phone Number"
                        placeholder="Enter phone number"
                        type="phone"
                        required={true}
                        name="PhoneNo"
                        value={newPersonnel.PhoneNo}
                        onChange={(value) => onInputChange(null, value, "PhoneNo")}
                        error={errors.PhoneNo}

                    />
                    <p className={`${errors.PhoneNo ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid phone number</p>
                </div>

                {/* Email */}
                <div>
                    <InputGroup
                        label="Email Address"
                        placeholder="Enter email address"
                        type="email"
                        required={true}
                        name="Email"
                        iconPosition='left'
                        icon={<FaEnvelope className='text-neutral-300' />}
                        error={errors.Email}
                        value={newPersonnel.Email}
                        onChange={(e) => onInputChange(e)}
                    />
                    <p className={`${errors.Email ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* {errors.Email}</p>
                </div>

                {/* Vehicle Type */}
                <div className='flex gap-2 justify-between cursor-pointer'>
                    <div className='flex-1'>
                        <InputGroup type='dropdown'
                            name='typeOfPersonnel'
                            label='Vehicle Type'
                            className={`${newPersonnel.typeOfPersonnel === '' && 'text-gray-400'}`}
                            value={newPersonnel.typeOfPersonnel}
                            onChange={handleChangeOfTypeOfPersonnel}
                            error={errors.typeOfPersonnel}
                            iconPosition="left"
                            icon={<FaCar className='text-neutral-300' />}
                            required={true}>
                            <option disabled value="">Select Vehicle Type</option>
                            <option value='Own Vehicle'>Own Vehicle</option>
                            <option value='Company Vehicle'>Company Vehicle</option>
                        </InputGroup>
                        <p className={`${errors.typeOfPersonnel ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide vehicle type</p>
                    </div>
                    {newPersonnel.typeOfPersonnelTrace?.length > 0 && (<div className='group relative self-center rounded-lg '>
                        <div className='absolute top-5 right-3 z-3 hidden group-hover:block bg-white  border border-neutral-200 max-h-[20rem] overflow-auto'>
                            <table className='table-general'>
                                <thead>
                                    {newPersonnel.typeOfPersonnelTrace?.length > 0 && <tr style={{ position: 'sticky', top: '1px', fontWeight: 'bold', borderBottom: '1px solid black', backgroundColor: 'white' }}>
                                        <td>Changed from</td>
                                        <td>Changed to</td>
                                        <td>Effective Date</td>
                                    </tr>}
                                </thead>
                                <tbody>
                                    {newPersonnel.typeOfPersonnelTrace?.length > 0 ? newPersonnel.typeOfPersonnelTrace.map((ToD) => (
                                        <tr>
                                            <td>{ToD.from}</td>
                                            <td>{ToD.to}</td>
                                            <td>{ToD.timestamp}</td>
                                        </tr>
                                    )) : <tr><td colSpan={3}>--No Changes recorded--</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <FcInfo size={25} />
                    </div>)}
                </div>

                {/* Sites */}
                {(personnelMode === 'create') && <div>
                    <InputGroup type='dropdown'
                        name='siteSelection'
                        label='Select Site'
                        className={`${newPersonnel.siteSelection === '' && 'text-gray-400'}`}
                        value={newPersonnel.siteSelection}
                        onChange={handleChangeOfSite}
                        error={errors.siteSelection}
                        iconPosition="left"
                        icon={<FaBuildingUser className='text-neutral-300' />}
                        required={true}>
                        <option value="">Select Site</option>
                        {sites?.map((site) => (
                            <option value={site.siteKeyword}>{site.siteName}</option>
                        ))}
                    </InputGroup>
                    <p className={`${errors.siteSelection ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please select a valid site</p>
                </div>}

                {/* TransportId */}
                <div>
                    <InputGroup
                        label="Transport Id"
                        placeholder="Enter transport id"
                        type="text"
                        name="transportId"
                        iconPosition='left'
                        icon={<GoNumber className='text-neutral-300' />}
                        value={newPersonnel.transportId}
                        onChange={(e) => onInputChange(e)}
                        error={errors.transportId}
                    />
                    <p className={`${errors.transportId ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid transport ID</p>
                </div>

                {/* Transporter Name */}
                <div>
                    <InputGroup
                        label="Transporter Name"
                        placeholder="Enter Transporter Name"
                        type="text"
                        name="transporterName"
                        iconPosition='left'
                        icon={<FaTruck className='text-neutral-300' />}
                        value={newPersonnel.transporterName}
                        onChange={(e) => onInputChange(e)}
                        error={errors.transporterName}
                    />
                    <p className={`${errors.transporterName ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid transporter name</p>
                </div>

                {/* UTR No. */}
                <div>
                    <InputGroup
                        label="UTR Number"
                        placeholder="Enter UTR number"
                        type="text"
                        name="utrNo"
                        iconPosition='left'
                        icon={<GoNumber className='text-neutral-300' />}
                        value={newPersonnel.utrNo}
                        onChange={(e) => onInputChange(e)}
                        error={errors.utrNo}
                    />
                    <p className={`${errors.utrNo ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid UTR number</p>
                </div>

                {/* VAT Number */}
                <div>
                    <InputGroup
                        label="VAT Number"
                        placeholder="Enter VAT No."
                        type="text"
                        name="vatNo"
                        iconPosition='left'
                        icon={<GoNumber className='text-neutral-300' />}
                        value={newPersonnel.vatDetails?.vatNo}
                        onChange={(e) => handleVatDetailsChange('vatNo', e.target.value)}
                        error={errors.vatNo}
                    />
                    <p className={`${errors.vatNo ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid VAT number</p>
                </div>

                <div>
                    <DatePicker
                        label="VAT Effective Date"
                        value={newPersonnel.vatDetails?.vatEffectiveDate ? new Date(newPersonnel.vatDetails?.vatEffectiveDate) : ''}
                        name="vatEffectiveDate"
                        iconPosition="left"
                        onChange={(value) => handleVatDetailsChange('vatEffectiveDate', value)}
                        disabled={!newPersonnel.vatDetails || newPersonnel.vatDetails?.vatNo === ''}
                        error={errors.vatEffectiveDate}
                    />
                    <p className={`${errors.vatEffectiveDate ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid VAT effective date</p>
                </div>
                <div>
                    <DatePicker
                        label="Date of Joining"
                        value={newPersonnel?.dateOfJoining ? new Date(newPersonnel.dateOfJoining) : ''}
                        name="dateOfJoining"
                        iconPosition="left"
                        onChange={(value) => onInputChange(null, value, "dateOfJoining")}
                        error={errors.dateOfJoining}
                    />
                    <p className={`${errors.dateOfJoining ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid date of joining</p>
                </div>
                <div>
                    <DatePicker
                        label="MOT Due expiry"
                        value={newPersonnel?.motDueExpiry ? new Date(newPersonnel.motDueExpiry) : ''}
                        name="motDueExpiry"
                        minDate={new Date()}
                        iconPosition="left"
                        onChange={(value) => onInputChange(null, value, "motDueExpiry")}
                        error={errors.motDueExpiry}
                    />
                    <p className={`${errors.motDueExpiry ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a mot expiry date</p>
                </div>
                <div>
                    <DatePicker
                        label="Road Tax Expiry"
                        value={newPersonnel?.roadTaxExpiry ? new Date(newPersonnel.roadTaxExpiry) : ''}
                        name="roadTaxExpiry"
                        minDate={new Date()}
                        iconPosition="left"
                        onChange={(value) => onInputChange(null, value, "roadTaxExpiry")}
                        error={errors.roadTaxExpiry}
                    />
                    <p className={`${errors.roadTaxExpiry ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a road tax expiry date</p>
                </div>
            </div>
        </div>
    );
};

export default PersonnelInfoTab;