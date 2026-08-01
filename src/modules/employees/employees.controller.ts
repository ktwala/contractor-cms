import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { EffectiveDatedService } from './effective-dated.service';
import { RecurringInputsService } from './recurring-inputs.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PatchEmployeeDto } from './dto/patch-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import {
  EmployeeResponseDto,
  PaginatedEmployeesDto,
  CompensationHistoryResponseDto,
  BankAccountHistoryResponseDto,
  TaxProfileHistoryResponseDto,
} from './dto/employee-response.dto';
import {
  CreateCompensationDto,
  CompensationResponseDto,
  CreateBankAccountDto,
  BankAccountResponseDto,
  CreateTaxProfileDto,
  TaxProfileResponseDto,
  CreateRecurringInputDto,
  RecurringInputResponseDto,
} from './dto/effective-dated.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiPayrollHeaders, ApiReasonHeader } from '../../common/decorators/api-headers.decorator';

@ApiTags('Employees')
@ApiBearerAuth('bearerAuth')
@Controller('employees')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly effectiveDatedService: EffectiveDatedService,
    private readonly recurringInputsService: RecurringInputsService,
  ) {}

  @Post()
  @Permissions('employee:write')
  @ApiOperation({ summary: 'Create an employee (minimum for payroll)' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 201, description: 'Created', type: EmployeeResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.create(dto, user.sub, reason);
  }

  @Get()
  @Permissions('employee:read')
  @ApiOperation({ summary: 'List employees' })
  @ApiResponse({ status: 200, description: 'OK', type: PaginatedEmployeesDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Query() query: ListEmployeesDto): Promise<PaginatedEmployeesDto> {
    return this.employeesService.findAll(query);
  }

  @Get(':employee_id')
  @Permissions('employee:read')
  @ApiOperation({ summary: 'Get an employee' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiResponse({ status: 200, description: 'OK', type: EmployeeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Param('employee_id') id: string): Promise<EmployeeResponseDto> {
    return this.employeesService.findOne(id);
  }

  @Patch(':employee_id')
  @Permissions('employee:write')
  @ApiOperation({ summary: 'Update an employee (limited)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Updated', type: EmployeeResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async patch(
    @Param('employee_id') id: string,
    @Body() dto: PatchEmployeeDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.patch(id, dto, user.sub, reason);
  }

  @Get(':employee_id/compensation')
  @Permissions('compensation:read')
  @ApiOperation({ summary: 'List compensation history (approved records)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiResponse({ status: 200, description: 'OK', type: CompensationHistoryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async listCompensation(@Param('employee_id') id: string): Promise<CompensationHistoryResponseDto> {
    return this.effectiveDatedService.getCompensationHistory(id);
  }

  @Get(':employee_id/bank-accounts')
  @Permissions('bank_account:read')
  @ApiOperation({ summary: 'List bank accounts (approved records; masked)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiResponse({ status: 200, description: 'OK', type: BankAccountHistoryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async listBankAccounts(@Param('employee_id') id: string): Promise<BankAccountHistoryResponseDto> {
    return this.effectiveDatedService.getBankAccountHistory(id);
  }

  @Get(':employee_id/tax-profile')
  @Permissions('tax_profile:read')
  @ApiOperation({ summary: 'List tax profile history (approved records)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiResponse({ status: 200, description: 'OK', type: TaxProfileHistoryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async listTaxProfiles(@Param('employee_id') id: string): Promise<TaxProfileHistoryResponseDto> {
    return this.effectiveDatedService.getTaxProfileHistory(id);
  }

  // ============================================================================
  // CREATE EFFECTIVE-DATED RECORDS
  // ============================================================================

  @Post(':employee_id/compensation')
  @Permissions('compensation:write')
  @ApiOperation({ summary: 'Add a compensation record (effective-dated salary)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiReasonHeader()
  @ApiResponse({ status: 201, description: 'Created', type: CompensationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async createCompensation(
    @Param('employee_id') employeeId: string,
    @Body() dto: CreateCompensationDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<CompensationResponseDto> {
    return this.effectiveDatedService.createCompensation(employeeId, dto, user.sub, reason);
  }

  @Post(':employee_id/bank-accounts')
  @Permissions('bank_account:write')
  @ApiOperation({ summary: 'Add a bank account (effective-dated; account number encrypted)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiReasonHeader()
  @ApiResponse({ status: 201, description: 'Created', type: BankAccountResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async createBankAccount(
    @Param('employee_id') employeeId: string,
    @Body() dto: CreateBankAccountDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<BankAccountResponseDto> {
    return this.effectiveDatedService.createBankAccount(employeeId, dto, user.sub, reason);
  }

  @Post(':employee_id/tax-profile')
  @Permissions('tax_profile:write')
  @ApiOperation({ summary: 'Add a tax profile (effective-dated tax residency)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiReasonHeader()
  @ApiResponse({ status: 201, description: 'Created', type: TaxProfileResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async createTaxProfile(
    @Param('employee_id') employeeId: string,
    @Body() dto: CreateTaxProfileDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<TaxProfileResponseDto> {
    return this.effectiveDatedService.createTaxProfile(employeeId, dto, user.sub, reason);
  }

  // ============================================================================
  // RECURRING INPUTS
  // ============================================================================

  @Get(':employee_id/recurring-inputs')
  @Permissions('recurring_input:read')
  @ApiOperation({ summary: 'List recurring inputs for an employee' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiQuery({ name: 'include_inactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'OK' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async listRecurringInputs(
    @Param('employee_id') employeeId: string,
    @Query('include_inactive') includeInactive?: boolean,
  ) {
    return this.recurringInputsService.listForEmployee(employeeId, includeInactive);
  }

  @Post(':employee_id/recurring-inputs')
  @Permissions('recurring_input:write')
  @ApiOperation({ summary: 'Add a recurring input (auto-applied each period)' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiReasonHeader()
  @ApiResponse({ status: 201, description: 'Created', type: RecurringInputResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async createRecurringInput(
    @Param('employee_id') employeeId: string,
    @Body() dto: CreateRecurringInputDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<RecurringInputResponseDto> {
    return this.recurringInputsService.create(employeeId, dto, user.sub, reason);
  }

  @Delete(':employee_id/recurring-inputs/:recurring_input_id')
  @Permissions('recurring_input:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a recurring input' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiParam({ name: 'recurring_input_id', example: 'ri_123' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Deactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deactivateRecurringInput(
    @Param('employee_id') employeeId: string,
    @Param('recurring_input_id') recurringInputId: string,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ) {
    return this.recurringInputsService.deactivate(employeeId, recurringInputId, user.sub, reason);
  }
}
