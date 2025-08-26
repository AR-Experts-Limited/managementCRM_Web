import React, { useState } from 'react';
import InputGroup from '../../../components/InputGroup/InputGroup';
import { FaUniversity, FaSortAmountUp, FaCreditCard, FaUser } from 'react-icons/fa';
import { IoEye, IoEyeOff } from 'react-icons/io5';

const BankDetails = ({ newPersonnel, onInputChange, errors }) => {
    const [showDetails, setShowDetails] = useState({
        showSortCode: false,
        showAccountNumber: false,
        showSortCodeCompany: false,
        showAccountNumberCompany: false
    });

    return (
        <div className='p-6'>
            <h1 className='text-center font-bold'>Bank Details</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5">
                    <div>
                        <InputGroup
                            type='text'
                            label="Bank Name"
                            name="bankDetails.bankName"
                            placeholder="Bank Name"
                            value={newPersonnel.bankDetails.bankName}
                            onChange={onInputChange}
                            iconPosition="left"
                            icon={<FaUniversity className='text-neutral-300' />}
                            required={true}
                            error={errors['bankDetails.bankName']}
                        />
                        <p className={`${errors.bankName ? 'visible' : 'invisible'} text-sm font-light text-red`}>* Please provide bank name</p>
                    </div>
                    <div className='relative'>
                        <InputGroup
                            type={showDetails.showSortCode ? 'text' : 'password'}
                            label="Sort Code"
                            name="bankDetails.sortCode"
                            maxLength={6}
                            placeholder="Sort Code"
                            value={newPersonnel.bankDetails.sortCode}
                            onChange={onInputChange}
                            iconPosition="left"
                            icon={<FaSortAmountUp className='text-neutral-300' />}
                            required={true}
                            error={errors['bankDetails.sortCode']}
                        />
                        <div
                            className='cursor-pointer absolute text-stone-300 top-[48%] right-5'
                            onClick={() => setShowDetails(prev => ({ ...prev, showSortCode: !prev.showSortCode }))}
                        >
                            {showDetails.showSortCode ? <IoEyeOff size={20} /> : <IoEye size={20} />}
                        </div>
                        <p className={`${errors.sortCode ? 'visible' : 'invisible'} text-sm font-light text-red`}>* Please provide a valid sort code</p>
                    </div>
                    <div className='relative'>
                        <InputGroup
                            type={showDetails.showAccountNumber ? 'text' : 'password'}
                            label="Account Number"
                            name="bankDetails.accNo"
                            maxLength={8}
                            placeholder="Account Number"
                            value={newPersonnel.bankDetails.accNo}
                            onChange={onInputChange}
                            iconPosition="left"
                            icon={<FaCreditCard className='text-neutral-300' />}
                            required={true}
                            error={errors['bankDetails.accNo']}
                        />
                        <div
                            className='cursor-pointer absolute text-stone-300 top-[48%] right-5'
                            onClick={() => setShowDetails(prev => ({ ...prev, showAccountNumber: !prev.showAccountNumber }))}
                        >
                            {showDetails.showAccountNumber ? <IoEyeOff size={20} /> : <IoEye size={20} />}
                        </div>
                        <p className={`${errors.bankAccountNumber ? 'visible' : 'invisible'} text-sm font-light text-red`}>* Please provide account number</p>
                    </div>
                    <div>
                        <InputGroup
                            type='text'
                            label="Account Name"
                            name="bankDetails.accName"
                            placeholder="Account Name"
                            value={newPersonnel.bankDetails.accName}
                            onChange={onInputChange}
                            iconPosition="left"
                            icon={<FaUser className='text-neutral-300' />}
                            required={true}
                            error={errors['bankDetails.accName']}
                        />
                        <p className={`${errors.accountName ? 'visible' : 'invisible'} text-sm font-light text-red`}>* Please provide account name</p>
                    </div>
            </div>
        </div>
    );
};

export default BankDetails;