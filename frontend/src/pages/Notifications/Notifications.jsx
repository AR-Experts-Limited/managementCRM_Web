import React, { useMemo, useEffect, useState } from 'react';
import { FixedSizeList } from 'react-window';
import TableFeatures from '../../components/TableFeatures/TableFeatures';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPersonnels, updatePersonnelDoc } from '../../features/personnels/personnelSlice';
import moment from 'moment';
import Modal from '../../components/Modal/Modal';
import DatePicker from '../../components/Datepicker/Datepicker';
import { AutoSizer } from "react-virtualized";

const Notifications = () => {
  const dispatch = useDispatch();
  const [modalContent, setModalContent] = useState(null);
  const [toastOpen, setToastOpen] = useState(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [notificationsList, setNotificationsList] = useState([]);
  const [repopulate, setRepopulate] = useState(false);
  const personnelsByRole = useSelector((state) => state.personnels.byRole);
  const { personnelStatus } = useSelector((state) => state.personnels);
  const { userDetails: currentUser } = useSelector((state) => state.auth);

  // Helper to safely unwrap a Date that may arrive as { $date: ... } or Date
  const unwrapDate = (d) => (d && typeof d === 'object' && '$date' in d ? d.$date : d) || null;

  // Get latest doc object from an array (by timestamp); if already an object, return as-is
  const sortLatestDocument = (docs) => {
    if (!docs) return null;
    if (Array.isArray(docs)) {
      if (docs.length === 0) return null;
      return [...docs].sort((a, b) => new Date(b?.timestamp || 0) - new Date(a?.timestamp || 0))[0];
    }
    return docs;
  };

  // Find index of latest doc within an array (by timestamp). Returns -1 when not found.
  const latestDocIndex = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return -1;
    let best = 0;
    for (let i = 1; i < arr.length; i++) {
      const t = new Date(arr[i]?.timestamp || 0).getTime();
      const bt = new Date(arr[best]?.timestamp || 0).getTime();
      if (t > bt) best = i;
    }
    return best;
  };

  useEffect(() => {
    const list =
      Object.values(personnelsByRole || {})
        .flat()
        .map((personnel) => {
          const dlExpiry = unwrapDate(personnel?.drivingLicenseDetails?.dlExpiry);
          const ecsExpiry = unwrapDate(personnel?.ecsDetails?.ecsExpiry);
          const passportExpiry = unwrapDate(personnel?.passportDetails?.passportExpiry);
          const rightToWorkExpiry = unwrapDate(personnel?.rightToWorkDetails?.rightToWorkExpiry);

          return {
            _id: personnel._id,
            personnel, // keep original object for updates
            siteSelection: personnel.siteSelection,
            role: personnel.role,
            personnelName: `${personnel.firstName} ${personnel.lastName}`,
            dlExpiry,
            ecsExpiry,
            passportExpiry,
            rightToWorkExpiry,
            activeStatus: personnel.activeStatus,
            suspended: personnel.suspended === 'Suspended' ? 'Suspended' : 'Active',
            disabled: personnel.disabled,
            // issuedFrom moved under passportDetails
            passportIssuedFrom: personnel?.passportDetails?.issuedFrom,
            // store the latest doc object (for modal display/buttons)
            drivingLicenseFrontImage: sortLatestDocument(personnel?.drivingLicenseFrontImage),
            drivingLicenseBackImage: sortLatestDocument(personnel?.drivingLicenseBackImage),
            passportDocument: sortLatestDocument(personnel?.passportDocument),
            rightToWorkCard: sortLatestDocument(personnel?.rightToWorkCard),
            ecsCard: sortLatestDocument(personnel?.ecsCard),
            expiredReasons: personnel.expiredReasons || [],
          };
        });
    setNotificationsList(list);
    setRepopulate(true);
  }, [personnelsByRole]);

  const columns = {
    'Site': 'siteSelection',
    'Role': 'role',
    'Personnel Name': 'personnelName',
    "Personnel's License Expiry": 'dlExpiry',
    'Passport Expiry': 'passportExpiry',
    'Right to Work Expiry': 'rightToWorkExpiry',
    'ECS Expiry': 'ecsExpiry',
    'Active Status': 'activeStatus',
    'Suspension Status': 'suspended'
  };

  // Map expiry field -> corresponding document array field(s) for approval UI
  const docVariableMap = {
    passportExpiry: 'passportDocument',
    dlExpiry: { front: 'drivingLicenseFrontImage', back: 'drivingLicenseBackImage' },
    rightToWorkExpiry: 'rightToWorkCard',
    ecsExpiry: 'ecsCard'
  };

  // Map expiry field -> human-friendly doc type label used in expiredReasons
  const docTypeMap = {
    passportExpiry: 'Passport Document',
    dlExpiry: 'Driving License',
    rightToWorkExpiry: 'Right to Work Card',
    ecsExpiry: 'ECS Card'
  };

  // Map expiry field -> nested path in updated schema (for saving new expiry)
  const expiryFieldPathMap = {
    passportExpiry: 'passportDetails.passportExpiry',
    dlExpiry: 'drivingLicenseDetails.dlExpiry',
    rightToWorkExpiry: 'rightToWorkDetails.rightToWorkExpiry',
    ecsExpiry: 'ecsDetails.ecsExpiry'
  };

  const [displayColumns, setDisplayColumns] = useState(columns);

  useEffect(() => {
    if (personnelStatus === 'idle') {
      dispatch(fetchPersonnels());
    }
  }, [personnelStatus, dispatch]);

  const getExpiryColor = (expiryDate) => {
    if (!expiryDate) return 'text-gray-500';
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 'text-red-500 font-bold'
      : diffDays <= 30 ? 'text-orange-500'
        : 'text-green-500';
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return diffDays < 0;
  };

  const formatDate = (date) => date ? moment(date).format('DD MMMM YYYY') : 'N/A';

  const handleUnarchivePersonnel = async (personnel, updates) => {
    try {
      await dispatch(updatePersonnelDoc({ personnel, updates })).unwrap();
      setToastOpen({
        content: `Personnel ${(() => {
          if (modalContent?.type === 'unarchive') return 'unarchived';
          if (modalContent?.type === 'inactive') return 'activated';
          if (modalContent?.type === 'unsuspend') return 'unsuspended';
          return 'updated';
        })()} successfully`
      });
    } catch (err) {
      console.error('Operation failed:', err);
      setToastOpen({ content: 'Failed to process personnel' });
    }
    setModalContent(null);
    setTimeout(() => setToastOpen(null), 2000);
  };

  const approveDocUpdate = async () => {
    if (!newExpiry || !modalContent?.notification) return;

    const personnel = modalContent.notification.personnel;
    const docName = modalContent.expiredDoc.name; // one of: dlExpiry, passportExpiry, rightToWorkExpiry, ecsExpiry
    const expiryDate = new Date(newExpiry);

    // Prepare expiredReasons cleanup
    const docType = docTypeMap[docName];
    let expiredReasons = Array.isArray(modalContent.notification.expiredReasons)
      ? [...modalContent.notification.expiredReasons]
      : [];

    expiredReasons = expiredReasons.filter((item) => item !== docType);

    // Build updates payload respecting nested paths and doc arrays
    const updates = {};

    // 1) Set the nested expiry date (dot-notation path)
    const nestedPath = expiryFieldPathMap[docName];
    if (nestedPath) {
      updates[nestedPath] = expiryDate;
    }

    // 2) Approve latest uploaded document in the relevant array(s)
    const approvedBy = {
      name: `${currentUser.userName}`,
      email: currentUser.email,
      role: currentUser.role,
      addedOn: new Date()
    };

    const approveLatestInArray = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return arr;
      const idx = latestDocIndex(arr);
      if (idx < 0) return arr;
      const item = arr[idx] || {};
      // Only meaningful if a temp upload exists
      const updatedItem = {
        ...item,
        original: item?.temp || item?.original || '',
        temp: item?.temp || item?.temp, // keep as-is
        timestamp: item?.timestamp ? new Date(item.timestamp) : new Date(),
        docApproval: true,
        approvedBy
      };
      const next = [...arr];
      next[idx] = updatedItem;
      return next;
    };

    if (docName === 'dlExpiry') {
      // Update both front and back images
      const frontKey = docVariableMap.dlExpiry.front;
      const backKey = docVariableMap.dlExpiry.back;
      updates[frontKey] = approveLatestInArray(personnel?.[frontKey] || []);
      updates[backKey] = approveLatestInArray(personnel?.[backKey] || []);
    } else {
      const arrayKey = docVariableMap[docName];
      if (arrayKey) {
        updates[arrayKey] = approveLatestInArray(personnel?.[arrayKey] || []);
      }
    }

    // 3) Update expiredReasons and possibly activeStatus
    updates.expiredReasons = expiredReasons;
    if (expiredReasons.length === 0) {
      updates.activeStatus = 'Active';
    }

    try {
      await dispatch(updatePersonnelDoc({ personnel, updates })).unwrap();
      setToastOpen({ content: 'Document updated successfully' });
      setModalContent(null);
      setNewExpiry('');
    } catch (err) {
      console.error('Document update failed:', err);
      setToastOpen({ content: 'Failed to update document' });
    }
    setTimeout(() => setToastOpen(null), 2000);
  };

  const denyDocUpdate = () => {
    setModalContent(null);
    setNewExpiry('');
    setToastOpen({ content: 'Document update denied' });
    setTimeout(() => setToastOpen(null), 2000);
  };

  const Row = ({ index, style }) => {
    const notification = notificationsList[index];
    // Check these document expiries
    const docFields = ['dlExpiry', 'passportExpiry', 'rightToWorkExpiry', 'ecsExpiry'];
    const hasExpiredDoc = docFields.some((col) => isExpired(notification[col]));
    const isInactiveAndNoExpired = !hasExpiredDoc && notification.activeStatus === 'Inactive';

    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', padding: '5px' }} key={notification._id}>
        <div className="flex w-full">
          <div className="flex justify-center items-center p-3 text-center w-8 max-w-8 text-sm border-b border-gray-300  dark:border-dark-5">
            {index + 1}
          </div>
          {Object.values(displayColumns).map((col, i) => (
            <div
              key={`${notification._id}-${i}`}
              className={`flex-1 flex items-center justify-center p-3 text-center min-w-32 text-sm border-b border-gray-300  dark:border-dark-5 ${
                ['dlExpiry', 'ecsExpiry', 'passportExpiry', 'rightToWorkExpiry', 'policyEndDate', 'motDueExpiry', 'roadTaxExpiry'].includes(col)
                  ? getExpiryColor(notification[col])
                  : ''
              }`}
            >
              {col === 'rightToWorkExpiry' && notification.passportIssuedFrom === 'United Kingdom' ? (
                'UK citizen'
              ) : col === 'activeStatus' ? (
                (notification.activeStatus === 'Archived' || (notification.activeStatus === 'Inactive' && isInactiveAndNoExpired)) ? (
                  <div
                    className="cursor-pointer hover:text-blue-500 bg-gray-300/50 rounded-md px-2 py-1 shadow"
                    onClick={() => setModalContent({
                      type: notification.activeStatus === 'Archived' ? 'unarchive' : 'inactive',
                      notification
                    })}
                  >
                    {notification.activeStatus}
                  </div>
                ) : (
                  notification.activeStatus || 'N/A'
                )
              ) : col === 'suspended' && notification.suspended === 'Suspended' ? (
                <div
                  className="cursor-pointer hover:text-blue-500 bg-gray-300/50 rounded-md px-2 py-1 shadow"
                  onClick={() => setModalContent({
                    type: 'unsuspend',
                    notification
                  })}
                >
                  Suspended
                </div>
              ) : ['dlExpiry', 'ecsExpiry', 'passportExpiry', 'rightToWorkExpiry', 'policyEndDate', 'motDueExpiry', 'roadTaxExpiry'].includes(col) && isExpired(notification[col]) ? (
                <div
                  className={`relative cursor-pointer ${!['motDueExpiry', 'roadTaxExpiry'].includes(col) ? 'hover:text-blue-500 bg-gray-300/50 shadow' : 'pointer-events-none'} rounded-md px-2 py-1`}
                  onClick={() => setModalContent({
                    type: 'expired_doc',
                    notification,
                    expiredDoc: { name: col, expiredOn: formatDate(notification[col]) }
                  })}
                >
                  {formatDate(notification[col])}
                  {(() => {
                    // Show pulsing dot if there is an unapproved temp upload for that doc
                    if (col === 'dlExpiry') {
                      const f = notification.drivingLicenseFrontImage;
                      const b = notification.drivingLicenseBackImage;
                      const needs = ((f?.temp && !f?.docApproval) || (b?.temp && !b?.docApproval));
                      return needs ? (
                        <div className="absolute -top-1 -right-1">
                          <span className="relative flex size-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex size-2.5 rounded-full bg-sky-500"></span>
                          </span>
                        </div>
                      ) : null;
                    } else {
                      const key = docVariableMap[col];
                      const doc = typeof key === 'string' ? notification[key] : null;
                      const needs = doc?.temp && !doc?.docApproval;
                      return needs ? (
                        <div className="absolute -top-1 -right-1">
                          <span className="relative flex size-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
                            <span className="relative inline-flex size-2.5 rounded-full bg-sky-500"></span>
                          </span>
                        </div>
                      ) : null;
                    }
                  })()}
                </div>
              ) : (
                ['dlExpiry', 'ecsExpiry', 'passportExpiry', 'rightToWorkExpiry', 'policyEndDate', 'motDueExpiry', 'roadTaxExpiry'].includes(col)
                  ? formatDate(notification[col])
                  : notification[col] || 'N/A'
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDocumentButtons = (docName, notification) => {
    if (docName !== 'dlExpiry') {
      const key = docVariableMap[docName]; // string
      const doc = typeof key === 'string' ? notification[key] : null;
      return doc?.temp ? (
        <a href={doc.temp} target="_blank" rel="noopener noreferrer">
          <button className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition">
            View
          </button>
        </a>
      ) : (
        <button className="bg-gray-300 text-gray-600 px-4 py-1 rounded cursor-not-allowed" disabled>
          No Document
        </button>
      );
    }

    const frontDoc = notification.drivingLicenseFrontImage;
    const backDoc = notification.drivingLicenseBackImage;
    return (
      <div className="flex space-x-4">
        <div>
          {frontDoc?.temp ? (
            <a href={frontDoc.temp} target="_blank" rel="noopener noreferrer">
              <button className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition">
                Front
              </button>
            </a>
          ) : (
            <button className="bg-gray-300 text-gray-600 px-4 py-1 rounded cursor-not-allowed" disabled>
              No Front
            </button>
          )}
        </div>
        <div>
          {backDoc?.temp ? (
            <a href={backDoc.temp} target="_blank" rel="noopener noreferrer">
              <button className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition">
                Back
              </button>
            </a>
          ) : (
            <button className="bg-gray-300 text-gray-600 px-4 py-1 rounded cursor-not-allowed" disabled>
              No Back
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDocumentTimestamps = (docName, notification) => {
    if (docName !== 'dlExpiry') {
      const key = docVariableMap[docName]; // string
      const doc = typeof key === 'string' ? notification[key] : null;
      return (
        <span className="text-gray-900">
          {doc?.timestamp ? new Date(doc.timestamp).toLocaleString() : "No Document Uploaded"}
        </span>
      );
    }

    const frontDoc = notification.drivingLicenseFrontImage;
    const backDoc = notification.drivingLicenseBackImage;
    return (
      <div className="text-gray-900 space-y-1">
        <div>
          <span className="font-medium text-gray-700">Front: </span>
          {frontDoc?.timestamp ? new Date(frontDoc.timestamp).toLocaleString() : "No Front Uploaded"}
        </div>
        <div>
          <span className="font-medium text-gray-700">Back: </span>
          {backDoc?.timestamp ? new Date(backDoc.timestamp).toLocaleString() : "No Back Uploaded"}
        </div>
      </div>
    );
  };

  const isDatePickerDisabled = (docName, notification) => {
    if (docName !== 'dlExpiry') {
      const key = docVariableMap[docName]; // string
      const doc = typeof key === 'string' ? notification[key] : null;
      return !doc?.temp;
    }
    const f = notification.drivingLicenseFrontImage?.temp;
    const b = notification.drivingLicenseBackImage?.temp;
    return !(f && b);
  };

  return (
    <div className="w-full h-full flex flex-col p-1.5 md:p-3.5">
      <div className={`${toastOpen ? 'opacity-100 translate-y-16' : 'opacity-0'} transition-all duration-200 border border-stone-200 fixed flex justify-center items-center top-4 left-1/2 -translate-x-1/2 bg-stone-50/30 dark:bg-dark/20 px-3 py-2 rounded-xl shadow-lg`}>
        <div className="flex gap-2 items-center">{toastOpen?.content}</div>
      </div>

      <h2 className="text-sm md:text-xl mb-2 font-bold dark:text-white">Notifications</h2>
      <div className="flex-1 flex flex-col w-full h-full bg-white rounded-3xl border border-neutral-200 overflow-hidden  dark:bg-dark dark:border-dark-5 dark:text-white">
        <div className="z-15 sticky top-0 flex items-center justify-between bg-white backdrop-blur-md p-2 rounded-t-lg border-b border-neutral-200  dark:bg-dark  dark:border-dark-5">
          <div className="text-sm md:text-base md:ml-3">Notifications List</div>
          <TableFeatures
            repopulate={repopulate}
            setRepopulate={setRepopulate}
            columns={columns}
            setColumns={setDisplayColumns}
            content={notificationsList}
            setContent={setNotificationsList}
          />
        </div>

        <div className="flex-1 flex flex-col h-full w-full  dark:bg-dark">
          <div className="flex w-full text-sm md:text-base sticky top-0 bg-white z-8 text-gray-400 border-b border-gray-300 dark:bg-dark  dark:border-dark-5">
            <div className="font-light py-2 px-0 text-center w-8 max-w-8">#</div>
            {Object.keys(displayColumns).map((col) => (
              <div key={col} className="flex-1 font-light py-2 px-0 text-center min-w-32">{col}</div>
            ))}
          </div>
          <div className="rounded-md flex-1 h-full  w-full">
            <AutoSizer>
              {({ width, height }) => (
                <FixedSizeList
                  height={height}
                  width={width}
                  itemCount={notificationsList.length}
                  itemSize={75}
                >
                  {Row}
                </FixedSizeList>
              )}
            </AutoSizer>
          </div>
        </div>
      </div>

      <Modal isOpen={!!modalContent}>
        <div className="flex flex-col">
          {modalContent?.type === 'unarchive' && (
            <>
              <div className="border-b border-neutral-300 p-3">Personnel Unarchival</div>
              <div className="p-4 py-10">
                <p>The Personnel: <b>{modalContent?.notification?.personnelName}</b> has not had any schedules for the past 5 days or more.<br />Are you sure you want to Un-Archive said personnel?</p>
              </div>
              <div className="flex gap-3 justify-end p-3 border-t border-neutral-300">
                <button
                  className="px-2 py-1 bg-primary-700 text-white text-sm rounded-md"
                  onClick={() => handleUnarchivePersonnel(modalContent.notification.personnel, { activeStatus: 'Active' })}
                >
                  Unarchive
                </button>
                <button
                  className="px-2 py-1 bg-gray-700 text-white text-sm rounded-md"
                  onClick={() => setModalContent(null)}
                >
                  Close
                </button>
              </div>
            </>
          )}
          {modalContent?.type === 'inactive' && (
            <>
              <div className="border-b border-neutral-300 p-3">Personnel Activate</div>
              <div className="p-4 py-10">
                <p>Are you sure you want to make <b>{modalContent?.notification?.personnelName}</b> active ?</p>
              </div>
              <div className="flex gap-3 justify-end p-3 border-t border-neutral-300">
                <button
                  className="px-2 py-1 bg-primary-700 text-white text-sm rounded-md"
                  onClick={() => handleUnarchivePersonnel(modalContent.notification.personnel, { activeStatus: 'Active' })}
                >
                  Make Active
                </button>
                <button
                  className="px-2 py-1 bg-gray-700 text-white text-sm rounded-md"
                  onClick={() => setModalContent(null)}
                >
                  Close
                </button>
              </div>
            </>
          )}
          {modalContent?.type === 'unsuspend' && (
            <>
              <div className="border-b border-neutral-300 p-3">Personnel Unsuspend</div>
              <div className="p-4 py-10">
                <p>The Personnel: <b>{modalContent?.notification?.personnelName}</b> has been suspended because of pending shifts.<br />Are you sure you want to Unsuspend said personnel?</p>
              </div>
              <div className="flex gap-3 justify-end p-3 border-t border-neutral-300">
                <button
                  className="px-2 py-1 bg-primary-700 text-white text-sm rounded-md"
                  onClick={() => handleUnarchivePersonnel(modalContent.notification.personnel, { suspended: 'Active' })}
                >
                  Unsuspend
                </button>
                <button
                  className="px-2 py-1 bg-gray-700 text-white text-sm rounded-md"
                  onClick={() => setModalContent(null)}
                >
                  Close
                </button>
              </div>
            </>
          )}
          {modalContent?.type === 'expired_doc' && (
            <div className="w-120">
              <div className="border-b border-neutral-300 p-3">Document Details</div>
              <div className="space-y-4 p-5">
                <div className="flex justify-between pb-2">
                  <span className="font-medium text-gray-700">Document</span>
                  <span className="text-gray-900">{docTypeMap[modalContent.expiredDoc.name]}</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="font-medium text-gray-700">Expired On</span>
                  <span className="text-gray-900">{modalContent.expiredDoc.expiredOn}</span>
                </div>
                <div className="flex justify-between items-center pb-4">
                  <div className="font-medium text-gray-700 mb-2">Updated Document</div>
                  {renderDocumentButtons(modalContent.expiredDoc.name, modalContent.notification)}
                </div>
                <div className="flex justify-between pb-4">
                  <span className="font-medium text-gray-700 block">Uploaded On</span>
                  {renderDocumentTimestamps(modalContent.expiredDoc.name, modalContent.notification)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">New Expiry Date</span>
                  <div className="w-42">
                    <DatePicker
                      iconPosition="left"
                      disabled={isDatePickerDisabled(modalContent.expiredDoc.name, modalContent.notification)}
                      onChange={(date) => setNewExpiry(date)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end p-3 border-t border-neutral-300">
                <button
                  className="px-2 py-1 bg-green-700 text-white text-sm rounded-md disabled:bg-gray-400"
                  disabled={!newExpiry}
                  onClick={approveDocUpdate}
                >
                  Approve
                </button>
                <button
                  disabled={!newExpiry}
                  className="px-2 py-1 bg-red-700 text-white text-sm rounded-md disabled:bg-gray-400"
                  onClick={denyDocUpdate}
                >
                  Deny
                </button>
                <button
                  className="px-2 py-1 bg-gray-700 text-white text-sm rounded-md"
                  onClick={() => setModalContent(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Notifications;