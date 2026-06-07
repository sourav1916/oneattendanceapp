export type SalaryComponentType = 'earning' | 'deduction' | 'employer_contribution';

export type SalaryCalcType = 'fixed' | 'percentage';

export type SalaryComponent = {
  id: number;
  name: string;
  code?: string;
  type: SalaryComponentType;
  is_active?: boolean;
};

export type SalaryComponentsListResponse = {
  success: boolean;
  message: string;
  data: SalaryComponent[] | null;
};

export type AssignSalaryComponentPayload = {
  component_id: number;
  calc_type: SalaryCalcType;
  calc_value: number;
  reason?: string;
};

export type AssignSalaryPayload = {
  employee_id: number;
  base_amount: number;
  effective_from: string;
  effective_to?: string;
  components?: AssignSalaryComponentPayload[];
};

export type AssignSalaryEmployee = {
  id: number;
  employee_code: string;
  name: string;
};

export type AssignSalaryData = {
  salary_id: number;
  employee: AssignSalaryEmployee;
  base_amount: number;
  effective_from: string;
  effective_to: string | null;
  components: AssignSalaryComponentPayload[];
};

export type AssignSalaryResponse = {
  success: boolean;
  message: string;
  data: AssignSalaryData | null;
};
