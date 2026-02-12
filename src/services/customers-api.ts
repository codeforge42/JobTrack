import axios from "axios";
import { Customer } from "@/types";
const BASE_URL = import.meta.env.VITE_BASE_URL;

export const addCustomer = async (name: string, email: string, password: string): Promise<Customer[]> => {
    const response = await axios.post(`${BASE_URL}/customers/register`, { name, email, password });
    return response.data.users;
};

// Fetch all customers
export const getCustomers = async (): Promise<Customer[]> => {
    const response = await axios.get(`${BASE_URL}/customers`);
    return response.data.customers;
};

// Fetch all jobs per customer customerId
export const getCustomerById = async (customerId: string): Promise<Customer> => {
    const response = await axios.get(`${BASE_URL}/customers/${customerId}`);
    return response.data.customer;
};


export const changePassword = async (email: string, currentPassword: string, newPassword: string): Promise<boolean> => {
    const response = await axios.put(`${BASE_URL}/customers/password`, { email, currentPassword, newPassword });
    return response.data.success;
};
