import { Home, Receipt, InventoryManagement, Medication,
UserFollow, Logout} from '@carbon/icons-react';

export const BACKEND_BASE_URL = "http://localhost:8000";

export type User = {
    id: number;
    username: string;
    openmrs_uuid: string;
};

export const navItems = [
    {
        "label": "Dashboard",
        "link": "/dashboard",
        "icon": <Home />,
    },
    {
        "label": "Bills",
        "link": "/bills",
        "icon": <Receipt />,
    },
    {
        "label": "Stock",
        "link": "/stock-management",
        "icon": <InventoryManagement />
    },
    {
        "label": "Pharmacy",
        "link": "/pharmacy",
        "icon": <Medication />
    },
    {
        "label": "Register User",
        "link": "/register",
        "icon": <UserFollow />
    },
    {
        "label": "Logout",
        "link": "/logout",
        "icon": <Logout />
    }
    // {
    //     "label": "Update Password",
    //     "link": "/update-password",
    //     "icon": <Password />
    // },

]