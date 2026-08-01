import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../core/database/prisma.service';

@ApiTags('Mobile - Employee')
@ApiBearerAuth('bearerAuth')
@Controller('api/mobile/employee')
@UseGuards(AuthGuard('jwt'))
export class MobileEmployeeController {
  constructor(private readonly prisma: PrismaService) { }

  @Get('profile')
  @ApiOperation({ summary: 'Get employee profile' })
  async getProfile(@Request() req: any) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          include: { manager: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!user?.employee) return { error: 'Employee not found' };

    const e = user.employee;
    return {
      id: e.id, employee_number: e.employeeNo, first_name: e.firstName, last_name: e.lastName,
      email: e.email, phone_number: e.phone, job_title: e.jobTitle, department: e.department,
      hire_date: e.hireDate, profile_picture_url: e.profilePictureUrl,
      manager_name: e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : null,
    };
  }

  @Post('profile/picture')
  @ApiOperation({ summary: 'Update profile picture' })
  @UseInterceptors(FileInterceptor('file'))
  async updateProfilePicture(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const url = `/uploads/profiles/profile_${Date.now()}_${file.originalname}`;
    await (this.prisma as any).employee.update({ where: { id: user.employeeId }, data: { profilePictureUrl: url } });
    return { success: true, url };
  }

  @Get('payslips')
  @ApiOperation({ summary: 'Get employee payslips' })
  async getPayslips(@Request() req: any, @Query('limit') limit = 12, @Query('offset') offset = 0) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    return (this.prisma as any).paySlip.findMany({
      where: { employeeId: user.employeeId },
      include: { payRun: { select: { payDate: true, status: true, periodStart: true, periodEnd: true } } },
      orderBy: { payRun: { payDate: 'desc' } },
      take: parseInt(String(limit)),
      skip: parseInt(String(offset)),
    });
  }

  @Get('payslips/:payslip_id')
  @ApiOperation({ summary: 'Get payslip details' })
  async getPayslipDetails(@Request() req: any, @Param('payslip_id') payslipId: string) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const payslip = await (this.prisma as any).paySlip.findFirst({
      where: { id: payslipId, employeeId: user.employeeId },
      include: { payRun: true, employee: { select: { employeeNo: true, firstName: true, lastName: true } } },
    });
    if (!payslip) return { error: 'Payslip not found' };

    return { payslip };
  }

  @Get('leave/requests')
  @ApiOperation({ summary: 'Get leave requests' })
  async getLeaveRequests(@Request() req: any, @Query('status') status?: string, @Query('limit') limit = 20) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    return (this.prisma as any).leaveRequest.findMany({
      where: { employeeId: user.employeeId, ...(status && { status }) },
      include: { approver: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit)),
    });
  }

  @Post('leave/request')
  @ApiOperation({ summary: 'Submit leave request' })
  async submitLeaveRequest(@Request() req: any, @Body() data: any) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const request = await (this.prisma as any).leaveRequest.create({
      data: {
        employeeId: user.employeeId,
        leaveType: data.leave_type,
        startDate: new Date(data.start_date),
        endDate: new Date(data.end_date),
        daysRequested: data.days_requested,
        reason: data.reason,
        status: 'pending',
      },
    });
    return { success: true, request_id: request.id };
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Get expense claims' })
  async getExpenseClaims(@Request() req: any, @Query('status') status?: string, @Query('limit') limit = 20) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    return (this.prisma as any).expenseClaim.findMany({
      where: { employeeId: user.employeeId, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit)),
    });
  }

  @Post('expenses/claim')
  @ApiOperation({ summary: 'Submit expense claim' })
  async submitExpenseClaim(@Request() req: any, @Body() data: any) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const claim = await (this.prisma as any).expenseClaim.create({
      data: {
        employeeId: user.employeeId,
        category: data.category,
        totalAmount: data.amount,
        currency: data.currency || 'ZAR',
        description: data.description,
        claimDate: new Date(data.expense_date),
        receiptUrl: data.receipt_url,
        status: 'draft',
      },
    });
    return { success: true, claim_id: claim.id };
  }

  @Post('expenses/:claim_id/receipt')
  @ApiOperation({ summary: 'Upload expense receipt' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadExpenseReceipt(@Param('claim_id') claimId: string, @UploadedFile() file: Express.Multer.File) {
    const url = `/uploads/receipts/receipt_${Date.now()}_${file.originalname}`;
    await (this.prisma as any).expenseClaim.update({ where: { id: claimId }, data: { receiptUrl: url } });
    return { success: true, url };
  }

  @Get('loans')
  @ApiOperation({ summary: 'Get loan applications' })
  async getLoanApplications(@Request() req: any, @Query('status') status?: string, @Query('limit') limit = 20) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    return (this.prisma as any).loanApplication.findMany({
      where: { employeeId: user.employeeId, ...(status && { status }) },
      include: { loanType: true },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit)),
    });
  }

  @Post('loans/apply')
  @ApiOperation({ summary: 'Apply for loan' })
  async applyForLoan(@Request() req: any, @Body() data: any) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const application = await (this.prisma as any).loanApplication.create({
      data: {
        employeeId: user.employeeId,
        loanTypeId: data.loan_type_id,
        requestedAmount: data.requested_amount,
        repaymentMonths: data.repayment_months,
        purpose: data.purpose,
        status: 'draft',
      },
    });
    return { success: true, application_id: application.id };
  }

  @Get('documents')
  @ApiOperation({ summary: 'Get employee documents' })
  async getDocuments(@Request() req: any, @Query('document_type') documentType?: string, @Query('limit') limit = 50) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    return (this.prisma as any).employeeDocument.findMany({
      where: { employeeId: user.employeeId, ...(documentType && { documentType }) },
      orderBy: { uploadedAt: 'desc' },
      take: parseInt(String(limit)),
    });
  }
}
