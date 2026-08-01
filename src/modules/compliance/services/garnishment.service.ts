import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

interface GarnishmentCalculation {
  grossPay: number;
  protectedAmount: number;
  availableForDeduction: number;
  deductionAmount: number;
}

export interface GarnishmentOrder {
  id: string;
  employeeId: string;
  orderType: string;
  orderNumber: string;
  courtName?: string;
  creditorName: string;
  deductionType: string;
  deductionAmount?: number;
  deductionPercentage?: number;
  priorityOrder: number;
  status: string;
}

// In-memory storage for garnishment orders (would use dedicated table in production)
const garnishmentOrders: Map<string, any> = new Map();

@Injectable()
export class GarnishmentService {
  private readonly logger = new Logger(GarnishmentService.name);
  private readonly PROTECTED_EARNINGS_PERCENTAGE = 0.25;

  constructor(private readonly prisma: PrismaService) { }

  // Create garnishment order
  async createGarnishmentOrder(orderData: any, userId: string): Promise<string> {
    const id = `garn_${Date.now()}`;
    const order = {
      id,
      employeeId: orderData.employeeId,
      orderType: orderData.orderType,
      orderNumber: orderData.orderNumber,
      courtName: orderData.courtName,
      creditorName: orderData.creditorName,
      deductionType: orderData.deductionType,
      deductionAmount: orderData.deductionAmount,
      deductionPercentage: orderData.deductionPercentage,
      priorityOrder: orderData.priorityOrder || 1,
      effectiveDate: orderData.effectiveDate,
      endDate: orderData.endDate,
      totalOwed: orderData.totalOwed,
      paidToDate: 0,
      status: 'active',
      createdBy: userId,
      createdAt: new Date(),
    };

    garnishmentOrders.set(id, order);
    this.logger.log(`Created garnishment order ${id} for employee ${orderData.employeeId}`);
    return id;
  }

  // Calculate garnishment deduction for a payslip
  async calculateGarnishmentDeduction(
    employeeId: string,
    grossPay: number,
  ): Promise<GarnishmentCalculation> {
    const activeOrders = Array.from(garnishmentOrders.values())
      .filter(o => o.employeeId === employeeId && o.status === 'active');

    if (activeOrders.length === 0) {
      return {
        grossPay,
        protectedAmount: grossPay,
        availableForDeduction: 0,
        deductionAmount: 0,
      };
    }

    const protectedAmount = grossPay * this.PROTECTED_EARNINGS_PERCENTAGE;
    const availableForDeduction = grossPay - protectedAmount;

    let totalDeduction = 0;
    let remaining = availableForDeduction;

    activeOrders.sort((a, b) => (a.priorityOrder || 1) - (b.priorityOrder || 1));

    for (const order of activeOrders) {
      if (remaining <= 0) break;

      let deduction = 0;
      if (order.deductionType === 'fixed' && order.deductionAmount) {
        deduction = Math.min(order.deductionAmount, remaining);
      } else if (order.deductionType === 'percentage' && order.deductionPercentage) {
        deduction = Math.min(grossPay * (order.deductionPercentage / 100), remaining);
      }

      totalDeduction += deduction;
      remaining -= deduction;
    }

    return {
      grossPay,
      protectedAmount: Math.round(protectedAmount * 100) / 100,
      availableForDeduction: Math.round(availableForDeduction * 100) / 100,
      deductionAmount: Math.round(totalDeduction * 100) / 100,
    };
  }

  // Get active garnishment orders for employee
  async getActiveOrders(employeeId: string): Promise<GarnishmentOrder[]> {
    return Array.from(garnishmentOrders.values())
      .filter(o => o.employeeId === employeeId && o.status === 'active');
  }

  // Get garnishment order details
  async getOrder(orderId: string): Promise<any | null> {
    return garnishmentOrders.get(orderId) || null;
  }

  // Suspend garnishment order
  async suspendOrder(orderId: string, reason: string, userId: string): Promise<void> {
    const order = garnishmentOrders.get(orderId);
    if (!order) {
      throw new Error('Garnishment order not found');
    }

    order.status = 'suspended';
    order.suspendedAt = new Date();
    order.suspendedBy = userId;
    order.suspendReason = reason;

    this.logger.log(`Garnishment order ${orderId} suspended`);
  }

  // Reactivate garnishment order
  async reactivateOrder(orderId: string, userId: string): Promise<void> {
    const order = garnishmentOrders.get(orderId);
    if (!order) {
      throw new Error('Garnishment order not found');
    }

    order.status = 'active';
    order.reactivatedAt = new Date();
    order.reactivatedBy = userId;

    this.logger.log(`Garnishment order ${orderId} reactivated`);
  }

  // Complete garnishment order
  async completeOrder(orderId: string): Promise<void> {
    const order = garnishmentOrders.get(orderId);
    if (!order) {
      throw new Error('Garnishment order not found');
    }

    order.status = 'completed';
    order.completedAt = new Date();

    this.logger.log(`Garnishment order ${orderId} completed`);
  }

  // Cancel garnishment order
  async cancelOrder(orderId: string, userId: string): Promise<void> {
    const order = garnishmentOrders.get(orderId);
    if (!order) {
      throw new Error('Garnishment order not found');
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = userId;

    this.logger.log(`Garnishment order ${orderId} cancelled`);
  }

  // Get garnishment summary for legal entity
  async getGarnishmentSummary(legalEntityId: string): Promise<any> {
    // Get employees for this legal entity
    const employees = await this.prisma.employee.findMany({
      where: {
        employments: {
          some: { legalEntityId },
        },
      },
      select: { id: true },
    });

    const employeeIds = new Set(employees.map(e => e.id));

    const activeOrders = Array.from(garnishmentOrders.values())
      .filter(o => employeeIds.has(o.employeeId) && o.status === 'active');

    const affectedEmployees = new Set(activeOrders.map(o => o.employeeId));

    return {
      activeOrders: activeOrders.length,
      employeesAffected: affectedEmployees.size,
      estimatedMonthlyDeductions: activeOrders.reduce(
        (sum, o) => sum + (o.deductionAmount || 0),
        0,
      ),
    };
  }
}
