import axios from "axios";
import { Company } from "@/types";
const BASE_URL = import.meta.env.VITE_BASE_URL;

export const getCompanies = async (customerId: string): Promise<Company[]> => {
    const response = await axios.get(`${BASE_URL}/customers-companies/${customerId}`);
    return response.data.companies;
};

export const createCompany = async (customerId: string, name: string, website: string, selector: string, linkedin: string, notes: string, period: string): Promise<Company[]> => {
    const response = await axios.post(`${BASE_URL}/customers-companies/${customerId}`, { name, website, selector, linkedin, notes, period });
    return response.data.companies;
};

export const updateCompany = async (customerId: string, companyId: string, data: Partial<Company>): Promise<Company> => {
    const response = await axios.put(`${BASE_URL}/customers-companies/${customerId}/${companyId}`, data);
    return response.data.company;
};

export const deleteCompany = async (customerId: string, companyId: string): Promise<Company[]> => {
    const response = await axios.delete(`${BASE_URL}/customers-companies/${customerId}/${companyId}`);
    return response.data.companies;
};

export const scanCompany = async (customerId: string, companyId: string, scanTypes?: string[]): Promise<string> => {
    console.log('scanTypes in API call:', scanTypes);
    const response = await axios.put(`${BASE_URL}/customers-companies/${customerId}/${companyId}/scan`, {
        scanTypes: scanTypes || ['website', 'linkedin']
    });
    return response.data.company;
};

export const scanAllCompanies = async (customerId: string, scanTypes?: string[]): Promise<Company[]> => {
    const response = await axios.post(`${BASE_URL}/customers-companies/${customerId}/scan`, {
        scanTypes: scanTypes || ['website', 'linkedin']
    });
    return response.data.companies;
};

export const deleteRecords = async (customerId: string, companyId: string, sourceType?: "website" | "linkedin"): Promise<string> => {
    const response = await axios.post(`${BASE_URL}/customers-companies/${customerId}/${companyId}/deleteRecords`, {
        sourceType: sourceType
    });
    return response.data.message;
};

export const deleteAllRecords = async (customerId: string): Promise<string> => {
    const response = await axios.post(`${BASE_URL}/customers-companies/${customerId}/deleteRecords`);
    return response.data.message;
};

/**
 * Analyze job links from JobLinks.xlsx; returns blob for download of new Excel with Remote column.
 */
export const analyzeJobLinksExport = async (customerId: string): Promise<Blob> => {
    const response = await axios.post(
        `${BASE_URL}/customers-companies/${customerId}/analyze-job-links`,
        {},
        { responseType: 'blob' }
    );
    return response.data;
};