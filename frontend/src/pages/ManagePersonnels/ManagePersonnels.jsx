import React, { useState, useEffect } from 'react';
import PersonnelsTable from './PersonnelsTable';
import { fetchPersonnels, deletePersonnel, disablePersonnel } from '../../features/personnels/personnelSlice';
import { useSelector, useDispatch } from 'react-redux';
import PersonnelForm from './PersonnelForm/PersonnelForm';
import { fetchSites } from '../../features/sites/siteSlice';
import { fetchRoles } from '../../features/roles/roleSlice';
import TableFeatures from '../../components/TableFeatures/TableFeatures';
import { useCallback } from 'react';
import Spinner from '../../components/UIElements/Spinner';

const ManagePersonnels = () => {
    const [personnelMode, setPersonnelMode] = useState('view')
    const [repopulate, setRepopulate] = useState(false)

    const dispatch = useDispatch();
    const clearPersonnel = {
        // top-level
        firstName: '',
        lastName: '',
        address: '',
        postcode: '',
        role: '',
        nationalInsuranceNumber: '',
        dateOfBirth: '',
        nationality: '',
        siteSelection: [],
        email: '',
        phone: '',
        role: '',

        // nested objects (complete shapes)
        vatDetails: { vatNo: '', vatEffectiveDate: '' },
        bankDetails: { bankName: '', sortCode: '', accNo: '', accName: '' },
        drivingLicenseDetails: { dlNumber: '', dlValidity: '', dlIssue: '', dlExpiry: '' },
        passportDetails: { issuedFrom: '', passportNumber: '', passportValidity: '', passportExpiry: '' },
        rightToWorkDetails: { rightToWorkValidity: '', rightToWorkExpiry: '' },
        ecsDetails: { active: false, ecsIssue: '', ecsExpiry: '' },
    };

    const [newPersonnel, setNewPersonnel] = useState(clearPersonnel);
    const { personnelStatus } = useSelector((state) => state.personnels);
    const { list: sites, siteStatus } = useSelector((state) => state.sites)
    const { list: roles, roleStatus } = useSelector((state) => state.roles);
    const { byRole: personnelsByRole, error } = useSelector((state) => state.personnels);
    const { userDetails } = useSelector((state) => state.auth);
    const [personnelsList, setPersonnelsList] = useState(Object.values(personnelsByRole).flat())
    const colList = { 'First Name': 'firstName', 'Last Name': 'lastName', 'Site': 'siteSelection', 'Role': 'role' }
    const [columns, setColumns] = useState(colList)
    const [toastOpen, setToastOpen] = useState(null)
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        setPersonnelsList(Object.values(personnelsByRole).flat())
        setRepopulate(true)
    }, [personnelsByRole, personnelMode])

    useEffect(() => {
        if (personnelStatus === 'idle') dispatch(fetchPersonnels());
        if (siteStatus === 'idle') dispatch(fetchSites())
        if (roleStatus === 'idle') dispatch(fetchRoles());
    }, [personnelStatus, siteStatus, roleStatus, dispatch]);

    const handleEditPersonnel = (personnel) => {
        setNewPersonnel({
            ...personnel,
            passportDocument: '',
            passportDocumentArray: personnel.passportDocument,
            drivingLicenseFrontImage: '',
            drivingLicenseBackImage: '',
            drivingLicenseFrontImageArray: personnel.drivingLicenseFrontImage,
            drivingLicenseBackImageArray: personnel.drivingLicenseBackImage,
            rightToWorkCard: '',
            rightToWorkCardArray: personnel.rightToWorkCard,
            profilePicture: '',
            profilePictureArray: personnel.profilePicture,
            ecsCard: '',
            ecsCardArray: personnel.ecsCard,
            PublicLiablityArray: personnel.PublicLiablity,
            profilePicture: '',
            profilePictureArray: personnel.profilePicture,
            signature: '',
            signatureArray: personnel.signature,
        })
        setPersonnelMode('edit')
    }

    const handleDeletePersonnel = useCallback(async (id, siteSelection, user_ID) => {
        try {
            await dispatch(deletePersonnel({ id, siteSelection })).unwrap();
            setToastOpen({ content: 'Personnel deleted successfully' });
        } catch (err) {
            console.error('Delete personnel failed:', err);
            setToastOpen({ content: 'Failed to delete personnel' });
        }
        setTimeout(() => setToastOpen(null), 2000)
        //await axios.delete(`${API_BASE_URL}/api/auth/deleteByUserID/${user_ID}`);
    }, [dispatch, setToastOpen]);

    const handleDisablePersonnel = useCallback(async ({ personnel, email, disabled }) => {
        try {
            await dispatch(disablePersonnel({ personnel, email, disabled })).unwrap();
            setToastOpen({ content: `Personnel ${disabled ? 'disabled' : 'enabled'} successfully` });
        } catch (err) {
            console.error('Disable personnel failed:', err);
            setToastOpen({ content: 'Failed to disable personnel' });
        }
        setTimeout(() => setToastOpen(null), 2000)
        //await axios.delete(`${API_BASE_URL}/api/auth/deleteByUserID/${user_ID}`);
    }, [dispatch, setToastOpen]);

    return (
        <div className='w-full h-full flex flex-col p-1.5 md:p-3.5'>

            <div className={`${toastOpen ? 'opacity-100 translate-y-16' : 'opacity-0'} transition-all duration-200 border border-stone-200  fixed flex justify-center items-center top-4 z-800 left-1/2 -translate-x-1/2 bg-stone-50/30 dark:bg-dark/20 px-3 py-2 rounded-xl shadow-lg`}>
                <div className='flex gap-2 items-center'>
                    {toastOpen?.content}
                </div>
            </div>
            <div className={`${processing ? 'opacity-100 translate-y-16' : 'opacity-0'} transition-all ease-in duration-200 border border-stone-200 fixed flex justify-center items-center z-800 backdrop-blur-sm top-4 left-1/2 -translate-x-1/2 bg-stone-400/20 dark:bg-dark/20 p-3 rounded-lg shadow-lg`}>
                <div className='flex gap-2 text-gray-500 justify-around items-center'>
                    <Spinner /> Processing...
                </div>
            </div>


            {personnelMode === 'view' && <h2 className='text-sm md:text-xl mb-2 font-bold dark:text-white'>Manage Personnels</h2>}
            <div className='flex flex-col w-full h-full bg-white rounded-lg border border-neutral-200'>
                <div className='z-15 sticky top-0 flex items-center justify-between items-center bg-white/60 backdrop-blur-md p-2 rounded-t-lg border-b border-neutral-200'>
                    <div className='text-sm md:text-base'>{personnelMode === 'create' ? 'Add Personnel' : 'Personnels List'}</div>
                    {personnelMode === 'view' &&
                        <div className='flex h-full flex-col md:flex-row gap-2'>
                            <div className='justify-self-start md:justify-self-end'><TableFeatures repopulate={repopulate} setRepopulate={setRepopulate} columns={colList} setColumns={setColumns} content={personnelsList} setContent={setPersonnelsList} /></div>
                            <button onClick={() => setPersonnelMode('create')} className='w-fit h-full self-end text-white bg-green-500 hover:bg-green-600  rounded-lg text-xs md:text-sm px-2 py-1'>Add Personnel</button>
                        </div>
                    }
                </div>
                {personnelMode === 'view' ? <PersonnelsTable userDetails={userDetails} handleEditPersonnel={handleEditPersonnel} handleDeletePersonnel={handleDeletePersonnel} columns={columns} personnelsList={personnelsList} onDisablePersonnel={handleDisablePersonnel} /> :
                    <PersonnelForm
                        userDetails={userDetails}
                        clearPersonnel={clearPersonnel}
                        newPersonnel={newPersonnel}
                        error={error}
                        setNewPersonnel={setNewPersonnel}
                        personnelMode={personnelMode}
                        setPersonnelMode={setPersonnelMode}
                        sites={sites}
                        roles={roles}
                        setToastOpen={setToastOpen}
                        setProcessing={setProcessing}
                        personnelsList={personnelsList}
                    />}
            </div>
        </div>
    );
};

export default ManagePersonnels;