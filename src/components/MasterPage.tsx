import React, { useState } from 'react';
import { ShieldCheck, Briefcase, Tags, Boxes, UserCog, Settings } from 'lucide-react';
import { ProjectMaster } from './masters/ProjectMaster';
import { VendorMaster } from './masters/VendorMaster';
import { ContractorMaster } from './masters/ContractorMaster';
import { CategoryMaster } from './masters/CategoryMaster';
import { UnitMaster } from './masters/UnitMaster';
import { RbacMaster } from './masters/RbacMaster';

interface MasterPageProps {
  userRole: string;
  permissions: any;
}

export function MasterPage({ userRole, permissions }: MasterPageProps) {
  const [activeMaster, setActiveMaster] = useState('rbac');

  const masterItems = [
    { 
      id: 'rbac', 
      label: 'RBAC Master', 
      icon: <UserCog className="w-5 h-5" />, 
      component: <RbacMaster userRole={userRole} />,
      description: 'Manage users, role permissions, and access governance.'
    },
    { 
      id: 'projects', 
      label: 'Project Master', 
      icon: <Briefcase className="w-5 h-5" />, 
      component: <ProjectMaster userRole={userRole} permissions={permissions} />,
      description: 'Define and configure project details and timelines.'
    },
    { 
      id: 'vendors', 
      label: 'Vendor Master', 
      icon: <ShieldCheck className="w-5 h-5" />, 
      component: <VendorMaster userRole={userRole} permissions={permissions} />,
      description: 'Maintain list of approved suppliers and vendors.'
    },
    { 
      id: 'contractors', 
      label: 'Contractor Registry', 
      icon: <UserCog className="w-5 h-5" />, 
      component: <ContractorMaster userRole={userRole} permissions={permissions} />,
      description: 'Manage contractor identity and verification.'
    },
    { 
      id: 'categories', 
      label: 'Category Master', 
      icon: <Tags className="w-5 h-5" />, 
      component: <CategoryMaster userRole={userRole} permissions={permissions} />,
      description: 'Manage material categories and groupings.'
    },
    { 
      id: 'units', 
      label: 'Unit Master', 
      icon: <Boxes className="w-5 h-5" />, 
      component: <UnitMaster userRole={userRole} permissions={permissions} />,
      description: 'Define measurement units for inventory items.'
    },
  ];

  const currentMaster = masterItems.find(item => item.id === activeMaster);

  return (
    <div className="flex h-full bg-slate-50">
      {/* Master Items Sidebar */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center text-gray-900 mb-1">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="font-bold text-lg tracking-tight">System Masters</h2>
          </div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Core Data Configuration</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {masterItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveMaster(item.id)}
              className={`w-full group flex flex-col p-3 rounded-xl text-left transition-all duration-200 border ${
                activeMaster === item.id 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
                  : 'bg-white border-gray-100 text-gray-600 hover:border-blue-200 hover:bg-blue-50/30'
              }`}
            >
              <div className="flex items-center mb-1">
                <span className={`${activeMaster === item.id ? 'text-white' : 'text-blue-500'}`}>
                  {item.icon}
                </span>
                <span className="ml-3 font-bold text-sm">{item.label}</span>
              </div>
              <p className={`text-[10px] leading-tight ${activeMaster === item.id ? 'text-blue-100' : 'text-gray-400'}`}>
                {item.description}
              </p>
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area Area */}
      <div className="flex-1 overflow-auto bg-gray-50 shadow-inner">
        <div className="p-8 max-w-6xl mx-auto">
          {currentMaster?.component || (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400 bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                <Boxes className="w-10 h-10 text-gray-200" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Master Configuration</h3>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                Select an active item from the sidebar to manage system data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
