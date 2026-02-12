import axios from "axios";
import { Customer, ScanConfig } from "@/types";
const BASE_URL = import.meta.env.VITE_BASE_URL;


export const addCustomer = async (name: string, website: string, linkedin: string): Promise<any[]> => {
    const response = await axios.post(`${BASE_URL}/admin`, { name, website, linkedin });
    return response.data.companies;
};

// Delete a customer
export const deleteCustomer = async (customer: any): Promise<any[]> => {
    const response = await axios.delete(`${BASE_URL}/admin`, { data: {customer} } );
    return response.data.companies;
};

export const updateCustomer = async (name: string, website: string, linkedin: string, customer: any): Promise<any[]> => {
    const response = await axios.put(`${BASE_URL}/admin`, { name, website, linkedin, data: {customer} });
    return response.data.companies;
};

export const changePassword = async (email: string, currentPassword: string, newPassword: string): Promise<boolean> => {
    const response = await axios.put(`${BASE_URL}/admin/password`, { email, currentPassword, newPassword });
    return response.data.success;
};

export const getAdmin = async (): Promise<any> => {
    const response = await axios.get(`${BASE_URL}/admin`);
    return response.data.user;
};

export const getCustomerById = async (id: number): Promise<any> => {
    const response = await axios.get(`${BASE_URL}/admin/${id}`);
    return response.data.customer;
};

export const scanPage = async (name: string, link: string): Promise<boolean> => {
    const response = await axios.put(`${BASE_URL}/admin/scanPage`, { name, link });
    return response.data.success;
};

export const scanAllPages = async (id: number): Promise<string> => {
    const response = await axios.put(`${BASE_URL}/admin/${id}/scan`);
    return response.data.message;
};

export const getScanConfig = async (): Promise<string[]> => {
    const response = await axios.post(`${BASE_URL}/admin/scan-config`);
    return JSON.parse(response.data.scan_config);
};

export const updateScanConfig = async (updates: Partial<ScanConfig>): Promise<boolean> => {
    const response = await axios.put(`${BASE_URL}/admin/scan-config`, { scan: updates.scanFrequency, Key: updates.openAiApiKey });
    return response.data.success;
};