import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ExpenseCategoriesService, CreateCategoryDto, CreatePolicyDto } from './services/expense-categories.service';
import { ExpenseClaimsService, CreateClaimDto, CreateExpenseItemDto } from './services/expense-claims.service';

@Controller('api/expenses')
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class ExpensesController {
  constructor(
    private readonly categoriesService: ExpenseCategoriesService,
    private readonly claimsService: ExpenseClaimsService,
  ) {}

  // =====================================================
  // CATEGORIES
  // =====================================================

  @Post('categories')
  @Permissions('expense.category.manage')
  async createCategory(@Body() createDto: CreateCategoryDto) {
    return this.categoriesService.createCategory(createDto);
  }

  @Get('categories')
  @Permissions('expense.claim.view')
  async getAllCategories(@Query('active_only') activeOnly?: string) {
    return this.categoriesService.getAllCategories(activeOnly !== 'false');
  }

  @Get('categories/:id')
  @Permissions('expense.claim.view')
  async getCategory(@Param('id') id: string) {
    return this.categoriesService.getCategoryById(id);
  }

  @Put('categories/:id')
  @Permissions('expense.category.manage')
  async updateCategory(@Param('id') id: string, @Body() updateDto: Partial<CreateCategoryDto>) {
    return this.categoriesService.updateCategory(id, updateDto);
  }

  @Post('categories/:id/deactivate')
  @Permissions('expense.category.manage')
  async deactivateCategory(@Param('id') id: string) {
    await this.categoriesService.deactivateCategory(id);
    return { message: 'Category deactivated successfully' };
  }

  @Post('categories/:id/activate')
  @Permissions('expense.category.manage')
  async activateCategory(@Param('id') id: string) {
    await this.categoriesService.activateCategory(id);
    return { message: 'Category activated successfully' };
  }

  // =====================================================
  // POLICIES
  // =====================================================

  @Post('policies')
  @Permissions('expense.policy.manage')
  async createPolicy(@Body() createDto: CreatePolicyDto) {
    return this.categoriesService.createPolicy(createDto);
  }

  @Get('policies')
  @Permissions('expense.claim.view')
  async getPolicies(@Query() query: any) {
    return this.categoriesService.getPolicies({
      category_id: query.category_id,
      policy_type: query.policy_type,
      country: query.country,
      active_only: query.active_only !== 'false',
    });
  }

  @Get('policies/:id')
  @Permissions('expense.claim.view')
  async getPolicy(@Param('id') id: string) {
    return this.categoriesService.getPolicyById(id);
  }

  @Put('policies/:id')
  @Permissions('expense.policy.manage')
  async updatePolicy(@Param('id') id: string, @Body() updateDto: Partial<CreatePolicyDto>) {
    return this.categoriesService.updatePolicy(id, updateDto);
  }

  @Post('policies/:id/deactivate')
  @Permissions('expense.policy.manage')
  async deactivatePolicy(@Param('id') id: string) {
    await this.categoriesService.deactivatePolicy(id);
    return { message: 'Policy deactivated successfully' };
  }

  @Get('policies/mileage-rate/:country')
  @Permissions('expense.claim.view')
  async getMileageRate(@Param('country') country: string) {
    const rate = await this.categoriesService.getMileageRate(country);
    return { country, rate };
  }

  // =====================================================
  // CLAIMS
  // =====================================================

  @Post('claims')
  @Permissions('expense.claim.create')
  async createClaim(@Body() createDto: CreateClaimDto, @Request() req: any) {
    return this.claimsService.createClaim({
      ...createDto,
      employee_id: createDto.employee_id || req.user.employee_id,
      created_by: req.user.id,
    });
  }

  @Get('claims')
  @Permissions('expense.all.view')
  async getAllClaims(@Query() query: any) {
    return this.claimsService.getAllClaims({
      status: query.status,
      from_date: query.from_date ? new Date(query.from_date) : undefined,
      to_date: query.to_date ? new Date(query.to_date) : undefined,
    });
  }

  @Get('claims/pending/approvals')
  @Permissions('expense.claim.approve')
  async getPendingApprovals() {
    return this.claimsService.getPendingApprovals();
  }

  @Get('employees/:employeeId/claims')
  @Permissions('expense.claim.view')
  async getEmployeeClaims(
    @Param('employeeId') employeeId: string,
    @Query('status') status?: string
  ) {
    return this.claimsService.getEmployeeClaims(employeeId, status);
  }

  @Get('claims/:id')
  @Permissions('expense.claim.view')
  async getClaim(@Param('id') id: string) {
    const claim = await this.claimsService.getClaimById(id);
    const items = await this.claimsService.getClaimItems(id);
    const history = await this.claimsService.getClaimHistory(id);

    return { claim, items, history };
  }

  @Post('claims/:id/submit')
  @Permissions('expense.claim.submit')
  async submitClaim(@Param('id') id: string, @Request() req: any) {
    return this.claimsService.submitClaim(id, req.user.id);
  }

  @Post('claims/:id/approve')
  @Permissions('expense.claim.approve')
  async approveClaim(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.claimsService.approveClaim(
      id,
      req.user.id,
      body.approved_amount,
      body.comments
    );
  }

  @Post('claims/:id/reject')
  @Permissions('expense.claim.reject')
  async rejectClaim(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (!body.reason) {
      throw new Error('Rejection reason is required');
    }

    await this.claimsService.rejectClaim(id, req.user.id, body.reason);
    return { message: 'Claim rejected successfully' };
  }

  @Post('claims/:id/cancel')
  @Permissions('expense.claim.delete')
  async cancelClaim(@Param('id') id: string, @Request() req: any) {
    await this.claimsService.cancelClaim(id, req.user.id);
    return { message: 'Claim cancelled successfully' };
  }

  // =====================================================
  // EXPENSE ITEMS
  // =====================================================

  @Post('items')
  @Permissions('expense.claim.edit')
  async addExpenseItem(@Body() createDto: CreateExpenseItemDto) {
    return this.claimsService.addExpenseItem(createDto);
  }

  @Get('claims/:claimId/items')
  @Permissions('expense.claim.view')
  async getClaimItems(@Param('claimId') claimId: string) {
    return this.claimsService.getClaimItems(claimId);
  }

  @Delete('items/:id')
  @Permissions('expense.claim.edit')
  async removeExpenseItem(@Param('id') id: string, @Request() req: any) {
    await this.claimsService.removeExpenseItem(id, req.user.id);
    return { message: 'Expense item removed successfully' };
  }

  // =====================================================
  // STATISTICS & REPORTS
  // =====================================================

  @Get('stats/summary')
  @Permissions('expense.reports.view')
  async getStatistics() {
    return this.claimsService.getClaimStatistics();
  }
}
