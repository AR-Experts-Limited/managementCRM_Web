import React from 'react';
import InputGroup from '../../../components/InputGroup/InputGroup';
import DatePicker from '../../../components/Datepicker/Datepicker';
import { FaHouseUser, FaIdCard } from 'react-icons/fa';
import { FaBuildingUser } from "react-icons/fa6";
import { GoNumber } from 'react-icons/go';
import { FaEye } from "react-icons/fa";
import { handleFileView } from '../supportFunctions'


const SelfEmploymentDetails = ({ newPersonnel, setNewPersonnel, onInputChange, errors, setErrors }) => {


    const handleCompanyVatDetailsChange = (name, value) => {
        // Write the field by path
        onInputChange(null, value, name);
        // If VAT No is cleared, also clear the effective date
        if (name === 'companyVatDetails.vatNo' && !value) {
          onInputChange(null, '', 'companyVatDetails.vatEffectiveDate');
        }
        setErrors(prev => ({ ...prev, [name]: false }));
    };


    return (
        <div className='p-6'>
            <h1 className='text-center font-bold'>Self-Employment Details</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                    <InputGroup
                        label="Company Name"
                        placeholder="Enter company name"
                        type="text"
                        name="companyName"
                        value={newPersonnel.companyName}
                        onChange={onInputChange}
                        iconPosition="left"
                        icon={<FaBuildingUser className='text-neutral-300' />}
                        required={true}
                        error={errors.companyName}
                    />
                    {errors.companyName && <p className='text-sm font-light text-red'>* Please provide company name</p>}
                </div>
                <div>
                    <InputGroup
                        label="Company Registered Address"
                        placeholder="Enter company address"
                        type="text"
                        name="companyRegAddress"
                        value={newPersonnel.companyRegAddress}
                        onChange={onInputChange}
                        iconPosition="left"
                        icon={<FaHouseUser className='text-neutral-300' />}
                        required={true}
                        error={errors.companyRegAddress}
                    />
                    {errors.companyRegAddress && <p className='text-sm font-light text-red'>* Please provide company registered address</p>}
                </div>
                <div>
                    <InputGroup
                        label="Company Registration Number"
                        placeholder="Enter company reg number"
                        type="text"
                        name="companyRegNo"
                        value={newPersonnel.companyRegNo}
                        onChange={onInputChange}
                        iconPosition="left"
                        icon={<FaIdCard className='text-neutral-300' />}
                        required={true}
                        error={errors.companyRegNo}
                    />
                    {errors.companyRegNo && <p className='text-sm font-light text-red'>* Please provide company registration number</p>}
                </div>
                <div>
                    <DatePicker
                        label="Company Registration Expiry"
                        value={newPersonnel?.companyRegExpiry ? new Date(newPersonnel?.companyRegExpiry) : ''}
                        name="companyRegExpiry"
                        iconPosition="left"
                        minDate={new Date()}
                        onChange={(value) => onInputChange(null, value, "companyRegExpiry")}
                        required={true}
                        error={errors.companyRegExpiry}
                    />
                    {errors.companyRegExpiry && <p className='text-sm font-light text-red'>* Please provide company registration expiry date</p>}
                </div>
                <div>
                    <InputGroup
                        label="Company UTR Number"
                        placeholder="Enter company UTR"
                        type="text"
                        name="companyUtrNo"
                        value={newPersonnel.companyUtrNo}
                        onChange={onInputChange}
                        iconPosition="left"
                        icon={<GoNumber className='text-neutral-300' />}
                    />
                </div>
                <div>
                    <InputGroup
                        label="VAT Number"
                        placeholder="Enter VAT No."
                        type="text"
                        name="companyVatDetails.vatNo"
                        iconPosition='left'
                        icon={<GoNumber className='text-neutral-300' />}
                        value={newPersonnel.companyVatDetails?.vatNo}
                        onChange={(e) => handleCompanyVatDetailsChange('companyVatDetails.vatNo', e.target.value)}
                        error={errors.companyVatNo}
                    />
                    <p className={`${errors.companyVatNo ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid VAT number</p>
                </div>

                <div>
                    <DatePicker
                        label="VAT Effective Date"
                        value={newPersonnel?.companyVatDetails?.vatEffectiveDate ? new Date(newPersonnel.companyVatDetails?.vatEffectiveDate) : ''}
                        name="companyVatDetails.vatEffectiveDate"
                        iconPosition="left"
                        onChange={(value) => handleCompanyVatDetailsChange('companyVatDetails.vatEffectiveDate', value)}
                        disabled={newPersonnel.companyVatDetails?.vatNo === ''}
                        error={errors.companyVatEffectiveDate}
                    />
                    <p className={`${errors.companyVatEffectiveDate ? 'visible' : 'invisible'} my-1 text-sm font-light text-red`}>* Please provide a valid VAT effective date</p>
                </div>
                <div className="col-span-3">
                    <InputGroup
                        type="file"
                        fileStyleVariant="style1"
                        label="Company Registration Certificate"
                        name="companyRegistrationCertificate"
                        onChange={(e) => onInputChange(e)}
                    />
                    {newPersonnel.companyRegistrationCertificateArray?.length > 0 &&
                        <div className='col-span-3 mt-2 rounded-md max-h-60 w-full border-2 border-neutral-200'>
                            <table className='table-general'>
                                <thead className='sticky top-0 bg-white'>
                                    <tr>
                                        <th colSpan={3}>
                                            History of Company Registration Certificate
                                        </th>
                                    </tr>
                                    <tr>
                                        <th>Version</th>
                                        <th>Actions</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...(newPersonnel.companyRegistrationCertificateArray || [])]
                                        .sort((a, b) => (new Date(b.timestamp) - new Date(a.timestamp))).map((doc, index) => (
                                            <tr>
                                                <td>{newPersonnel.companyRegistrationCertificateArray.length - index}</td>
                                                <td>
                                                    <div className='flex justify-around'>
                                                        <div onClick={() => handleFileView(doc.original)}
                                                            className='rounded-md p-2 hover:bg-neutral-200'><FaEye size={15} /></div>
                                                    </div>
                                                </td>
                                                <td>{new Date(doc.timestamp).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>}
                </div>
            </div>
        </div>
    );
};

export default SelfEmploymentDetails;