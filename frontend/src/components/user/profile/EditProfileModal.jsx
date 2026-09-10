import React, { useState } from 'react';
import { useBattery } from '../../../context/BatteryContext';
import { Modal } from '../../common/Modal';
import { X, User } from 'lucide-react';

export const EditProfileModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return <EditProfileForm onClose={onClose} />;
};

const EditProfileForm = ({ onClose }) => {
  const { userProfile, updateProfile } = useBattery();

  const [formData, setFormData] = useState({
    name: userProfile.name,
    title: userProfile.title,
    email: userProfile.email,
    phone: userProfile.phone,
    location: userProfile.location,
    avatar: userProfile.avatar,
    fleetType: userProfile.fleetType,
    euOperatorId: userProfile.euOperatorId
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfile(formData);
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} z={50}>
      <div className="relative w-full max-w-xl bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#16263A]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#EEE9DA] bg-[#F5F1E7]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#FBF1C9] border border-[#F0E6C8] text-[#A77A08]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#16263A]">Edit User Profile & Fleet Info</h3>
              <p className="text-xs text-[#747B83]">Update operator details and EU registry identifiers</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#8A9096] hover:text-[#16263A] rounded-xl hover:bg-[#E7E1D3] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#16263A] mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] focus:outline-none focus:border-[#173B5C] font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-[#16263A] mb-1.5">Job Title / Role</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] focus:outline-none focus:border-[#173B5C] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#16263A] mb-1.5">Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] focus:outline-none focus:border-[#173B5C] font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-[#16263A] mb-1.5">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] focus:outline-none focus:border-[#173B5C] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-[#16263A] mb-1.5">Location / City</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] focus:outline-none focus:border-[#173B5C] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#16263A] mb-1.5">EU Operator Registry ID</label>
            <input
              type="text"
              value={formData.euOperatorId}
              onChange={(e) => setFormData({ ...formData, euOperatorId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] font-mono focus:outline-none focus:border-[#173B5C] font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-[#16263A] mb-1.5">Avatar Image URL</label>
            <input
              type="url"
              value={formData.avatar}
              onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E7] border border-[#E7E1D3] text-[#16263A] font-mono focus:outline-none focus:border-[#173B5C]"
            />
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-[#EEE9DA]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#F5F1E7] text-[#16263A] font-bold hover:bg-[#E7E1D3] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#173B5C] hover:bg-[#102F4A] text-white font-black shadow-sm transition-all"
            >
              Save Profile Changes
            </button>
          </div>

        </form>
      </div>
    </Modal>
  );
};
