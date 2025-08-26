import { useState, useEffect, useRef } from 'react'
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.scss'
import { startSSE, stopSSE } from './features/sse/sseSlice';
import { useSelector, useDispatch } from 'react-redux';
import Login from './pages/Login/Login';
import Deductions from './pages/Deductions/Deductions';
import Incentives from './pages/Incentives/Incentives';
import AdditionalCharges from './pages/AdditionalCharges/AdditionalCharges';
import Sidebar from './components/Sidebar/Sidebar';
import Navbar from './components/Navbar/Navbar';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import ManagePersonnels from './pages/ManagePersonnels/ManagePersonnels';
import Notifications from './pages/Notifications/Notifications';

function App() {
  const [count, setCount] = useState(0)
  const dispatch = useDispatch();
  const [sidebarIsOpen, setSidebarIsOpen] = useState(0);
  const { userDetails } = useSelector((state) => state.auth);
  const hideLayout = location.pathname === '/login' || location.pathname === '/';
  //const personnelsLoading = useSelector((state) => state.personnels.personnelStatus);
  const sitesLoading = useSelector((state) => state.sites.siteStatus);
  const rolesLoading = useSelector((state) => state.roles.roleStatus);
  const isLoading = sitesLoading === 'loading' || rolesLoading === 'loading';
  const timeoutRefOpener = useRef(null);

  useEffect(() => {
    dispatch(startSSE());

    return () => {
      dispatch(stopSSE());
    };
  }, [dispatch]);

  const routes = [
  //  { path: "/dashboard", name: "Dashboard", component: Dashboard },
  //  { path: "/rate-card", name: "Rate Cards", component: Ratecard },
  //  { path: "/planner", name: "Schedule Planner", component: SchedulePlanner },
    { path: "/manage-personnels", name: "Manage Personnels", component: ManagePersonnels },
    { path: "/notifications", name: "Notifications", component: Notifications },
  //  { path: "/approvals", name: "Approvals", component: Approvals },
  //  { path: "/live-operations", name: "Live Operations", component: LiveOperations },
  //  { path: "/rota", name: "Rota", component: Rota },
    { path: "/deductions", name: "Deductions", component: Deductions },
    { path: "/incentives", name: "Incentives", component: Incentives },
  //  { path: "/manage-summary", name: "Manage Summary", component: ManageSummary },
  //  { path: "/manage-payments", name: "Manage Payments", component: DailyInvoice },
    { path: "/add-ons", name: "Additional Charges", component: AdditionalCharges },
  //  { path: "/print-invoices", name: "Print Invoices", component: WeeklyInvoice },
  //  { path: "/profit-loss", name: "Profit / Loss", component: ProfitLoss },
  //  { path: "/working-hours", name: "Working Hours", component: WorkingHours },
  //  { path: "/manage-users", name: "Manage Users", component: ManageUsers },
  //  { path: "/settings", name: "Application Settings", component: ApplicationSettings },
  ];

  const handleMouseEnterOpener = () => {
    if (!sidebarIsOpen) {
      timeoutRefOpener.current = setTimeout(() => {
        setSidebarIsOpen(true);
      }, 800);
    }
  };

  const handleMouseLeaveOpener = () => {
    if (timeoutRefOpener.current) {
      clearTimeout(timeoutRefOpener.current);
      timeoutRefOpener.current = null;
    }
  };

  return (
    <div className="app fixed bg-stone-100 dark:bg-dark-3 w-screen h-screen flex flex-col">
      {!hideLayout && <Navbar sidebarIsOpen={sidebarIsOpen} setSidebarIsOpen={setSidebarIsOpen} />}

      <div className="flex flex-1 overflow-hidden">
        {!hideLayout && (<>
          <div className={`transition-all duration-300 ${sidebarIsOpen ? 'w-22.5 md:w-60' : 'w-0 md:w-22.5'}`}>
            <Sidebar sidebarIsOpen={sidebarIsOpen} setSidebarIsOpen={setSidebarIsOpen} />
          </div>
          <div
            className='h-full absolute top-0 left-0 w-0.5'
            // onMouseEnter={handleMouseEnterOpener}
            // onMouseLeave={handleMouseLeaveOpener}
          >
          </div>
          {userDetails?.role === 'OSM' && <OverdueShiftBubble userSite={userDetails?.site} />}
        </>
        )}
        <div className={`flex-1 overflow-auto ${sidebarIsOpen && 'max-sm:blur-xs max-sm:pointer-events-none '}`} >
          {(isLoading)
            ? <div className='h-full w-full flex justify-center items-center '><img className='w-50 h-30' src="/bizalign_loading_loop.gif" /></div> // You can show a spinner here

            : (<Routes>
              <Route path="/login" element={<Login />} />
              {routes.map(({ path, name, component: Component }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <ProtectedRoute routeName={name}>
                      <Component />
                    </ProtectedRoute>
                  }
                />
              ))}
              {/* <Route path="*" element={<Navigate to="/login" replace />} /> */}
            </Routes>)}
        </div>
      </div>
    </div >
  )
}

export default App
