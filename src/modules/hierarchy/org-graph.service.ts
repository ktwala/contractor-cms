import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export type OrgGraphNode = {
  managerId: string | null;
  reports: string[];
};

/**
 * Org Graph Service — builds an in-memory representation of the organizational hierarchy
 * from Employee.managerId. Powers approval routing, hierarchy validation, and queries.
 */
@Injectable()
export class OrgGraphService {
  private graph: Map<string, OrgGraphNode> = new Map();
  private employeeIds: Set<string> = new Set();
  private lastBuiltAt: number = 0;
  private readonly TTL_MS = 60_000; // 1 minute cache

  constructor(private readonly prisma: PrismaService) {}

  async buildGraph(force = false): Promise<void> {
    const now = Date.now();
    if (!force && this.graph.size > 0 && now - this.lastBuiltAt < this.TTL_MS) {
      return;
    }
    this.graph.clear();
    this.employeeIds.clear();

    const employees = await this.prisma.employee.findMany({
      select: { id: true, managerId: true },
    });

    for (const e of employees) {
      this.employeeIds.add(e.id);
      this.graph.set(e.id, {
        managerId: e.managerId,
        reports: [],
      });
    }
    for (const e of employees) {
      if (e.managerId) {
        const managerNode = this.graph.get(e.managerId);
        if (managerNode) {
          managerNode.reports.push(e.id);
        }
      }
    }
    this.lastBuiltAt = now;
  }

  async getManager(employeeId: string): Promise<string | null> {
    await this.buildGraph();
    return this.graph.get(employeeId)?.managerId ?? null;
  }

  async getDirectReports(managerId: string): Promise<string[]> {
    await this.buildGraph();
    return this.graph.get(managerId)?.reports ?? [];
  }

  async getAllReports(managerId: string): Promise<string[]> {
    await this.buildGraph();
    const result: string[] = [];
    const queue = [...(this.graph.get(managerId)?.reports ?? [])];
    while (queue.length > 0) {
      const id = queue.shift()!;
      result.push(id);
      queue.push(...(this.graph.get(id)?.reports ?? []));
    }
    return result;
  }

  async getManagerChain(employeeId: string): Promise<string[]> {
    await this.buildGraph();
    const chain: string[] = [];
    let current: string | null = employeeId;
    const visited = new Set<string>();
    while (current) {
      const node = this.graph.get(current);
      if (!node?.managerId) break;
      if (visited.has(node.managerId)) break; // cycle guard
      visited.add(node.managerId);
      chain.push(node.managerId);
      current = node.managerId;
    }
    return chain;
  }

  async getOrgRoot(employeeId: string): Promise<string | null> {
    const chain = await this.getManagerChain(employeeId);
    return chain.length > 0 ? chain[chain.length - 1] : employeeId;
  }

  async getHierarchyDepth(): Promise<number> {
    await this.buildGraph();
    let maxDepth = 0;
    const depths = new Map<string, number>();

    const getDepth = (id: string): number => {
      if (depths.has(id)) return depths.get(id)!;
      const node = this.graph.get(id);
      if (!node?.managerId) {
        depths.set(id, 0);
        return 0;
      }
      const d = 1 + getDepth(node.managerId);
      depths.set(id, d);
      return d;
    };

    for (const id of this.graph.keys()) {
      const d = getDepth(id);
      if (d > maxDepth) maxDepth = d;
    }
    return maxDepth;
  }

  invalidateCache(): void {
    this.graph.clear();
    this.employeeIds.clear();
    this.lastBuiltAt = 0;
  }
}
