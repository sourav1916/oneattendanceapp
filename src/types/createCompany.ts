export type CreateCompanyBody = {
  name: string;
  legal_name?: string;
  logo_url?: string;
};

export type CreateCompanyResponse = {
  success: boolean;
  message: string;
};
