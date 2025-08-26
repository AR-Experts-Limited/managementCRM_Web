import React, { useRef, useState, useEffect } from 'react';
import InputGroup from '../../../components/InputGroup/InputGroup';
import DatePicker from '../../../components/Datepicker/Datepicker';
import { FaHouseUser, FaUser, FaEnvelope, FaIdCard, FaGlobe, FaCar, FaPhone, FaTruck } from 'react-icons/fa';
import { FaBuildingUser } from "react-icons/fa6";
import { GoNumber } from 'react-icons/go';
import countries from '../../../lib/countries';
import { FcInfo } from 'react-icons/fc';
import Nationality from '../../../lib/Nationality';

const PersonnelInfoTab = ({ sites, userDetails, newPersonnel, setNewPersonnel, onInputChange, errors, setErrors, age, setAge, personnelMode, roles }) => {
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

    const handleVatDetailsChange = (name, value) => {
        // Write the field by path
        onInputChange(null, value, name);
        // If VAT No is cleared, also clear the effective date
        if (name === 'vatDetails.vatNo' && !value) {
          onInputChange(null, '', 'vatDetails.vatEffectiveDate');
        }
        setErrors(prev => ({ ...prev, [name]: false }));
    };

    const handleChangeOfSite = (e) => {
        setNewPersonnel(prev => ({ ...prev, siteSelection: e.target.value }));
    };

    const siteOptions = (sites ?? []).map(s => ({ label: s.siteName, value: s.siteKeyword }));

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
                        name="phone"
                        value={newPersonnel.phone}
                        onChange={(value) => onInputChange(null, value, "phone")}
                        error={errors.phone}

                    />
                    <p className={`${errors.phone ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid phone number</p>
                </div>

                {/* Email */}
                <div>
                    <InputGroup
                        label="Email Address"
                        placeholder="Enter email address"
                        type="email"
                        required={true}
                        name="email"
                        iconPosition='left'
                        icon={<FaEnvelope className='text-neutral-300' />}
                        error={errors.email}
                        value={newPersonnel.email}
                        onChange={(e) => onInputChange(e)}
                    />
                    <p className={`${errors.Email ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* {errors.email}</p>
                </div>

                {/* Sites */}
                {(personnelMode === 'create') && <div>
                    <InputGroup
                        type="multiselect"
                        name="siteSelection"
                        label="Select Site(s)"
                        placeholder="Select site(s)"
                        value={newPersonnel.siteSelection}
                        onChange={handleChangeOfSite}
                        error={errors.siteSelection}
                        iconPosition="left"
                        icon={<FaBuildingUser className="text-neutral-300" />}
                        required={true}
                        options={siteOptions}
                    />
                    <p className={`${errors.siteSelection ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please select a valid site</p>
                </div>}

                {(personnelMode === 'create') && <div>
                    <InputGroup type='dropdown'
                        name='role'
                        label='Select Role'
                        className={`${newPersonnel.role === '' && 'text-gray-400'}`}
                        value={newPersonnel.role}
                        onChange={(e) => onInputChange(e)}
                        error={errors.role}
                        iconPosition="left"
                        icon={<FaBuildingUser className='text-neutral-300' />}
                        required={true}>
                        <option value="">-Select Role-</option>
                        {roles.map((role) => (
                            <option key={role.roleName} value={role.roleName}>
                                {role.roleName}
                            </option>
                        ))}
                    </InputGroup>
                    <p className={`${errors.siteSelection ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please select a valid site</p>
                </div>}

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
                        name="vatDetails.vatNo"
                        iconPosition='left'
                        icon={<GoNumber className='text-neutral-300' />}
                        value={newPersonnel.vatDetails?.vatNo ?? ''}
                        onChange={(e) => handleVatDetailsChange('vatDetails.vatNo', e.target.value)}
                        error={errors['vatDetails.vatNo']}
                    />
                    <p className={`${errors['vatDetails.vatNo'] ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid VAT number</p>
                </div>

                <div>
                    <DatePicker
                        label="VAT Effective Date"
                        value={newPersonnel.vatDetails?.vatEffectiveDate ? new Date(newPersonnel.vatDetails.vatEffectiveDate) : ''}
                        name="vatDetails.vatEffectiveDate"
                        iconPosition="left"
                        onChange={(v) => handleVatDetailsChange('vatDetails.vatEffectiveDate', v)}
                        disabled={!newPersonnel.vatDetails || newPersonnel.vatDetails?.vatNo === ''}
                        error={errors['vatDetails.vatEffectiveDate']}
                    />
                    <p className={`${errors['vatDetails.vatEffectiveDate'] ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid VAT effective date</p>
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
            </div>
        </div>
    );
};

export default PersonnelInfoTab;