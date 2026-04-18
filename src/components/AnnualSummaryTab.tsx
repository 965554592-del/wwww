import React, { useMemo } from 'react';
import { Entry } from '../types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileText, TrendingUp, Presentation, CalendarDays } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

interface Props {
  entries: Entry[];
  reductionRate: number;
}

export default function AnnualSummaryTab({ entries, reductionRate }: Props) {
  const reductionMultiplier = useMemo(() => (100 - reductionRate) / 100, [reductionRate]);

  // Aggregate data by periodName
  const periodData = useMemo(() => {
    const summary: Record<string, number> = {};
    let totalAll = 0;
    
    entries.forEach(entry => {
      const period = entry.periodName || '未分类周期';
      if (!summary[period]) {
        summary[period] = 0;
      }
      summary[period] += entry.subtotal;
      totalAll += entry.subtotal;
    });

    // Create an array and sort it logically. 
    // Simply sorting by period name alphabetically/numerically usually works for formats like "2023-11" or "2023第1期"
    const sortedPeriods = Object.keys(summary).sort((a, b) => a.localeCompare(b));
    
    const chartData = sortedPeriods.map(period => ({
      name: period,
      amount: summary[period],
      fmtAmount: Number(summary[period].toFixed(2)),
      reducedAmount: summary[period] * reductionMultiplier,
      fmtReducedAmount: Number((summary[period] * reductionMultiplier).toFixed(2))
    }));

    const totalReducedAll = totalAll * reductionMultiplier;

    return { chartData, totalAll, totalReducedAll };
  }, [entries, reductionMultiplier]);

  // Aggregate data by month for the line chart
  const monthlyData = useMemo(() => {
    const summary: Record<string, number> = {};
    entries.forEach(entry => {
      // Safely get YYYY-MM prefix from date "YYYY-MM-DD"
      const month = entry.date && entry.date.length >= 7 ? entry.date.substring(0, 7) : '未知月份';
      if (!summary[month]) {
        summary[month] = 0;
      }
      summary[month] += entry.subtotal;
    });

    const sortedMonths = Object.keys(summary).sort((a, b) => a.localeCompare(b));
    return sortedMonths.map(month => ({
      month,
      amount: summary[month],
      fmtAmount: Number(summary[month].toFixed(2)),
      reducedAmount: summary[month] * reductionMultiplier,
      fmtReducedAmount: Number((summary[month] * reductionMultiplier).toFixed(2))
    }));
  }, [entries, reductionMultiplier]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount);
  };

  const exportToWord = async () => {
    if (periodData.chartData.length === 0) return;

    // Calculate peaks based on actual expenditure (reduced amount)
    const maxPeriod = [...periodData.chartData].sort((a, b) => b.reducedAmount - a.reducedAmount)[0];
    const avgReducedAmount = periodData.totalReducedAll / periodData.chartData.length;

    // Create header row
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            shading: { fill: "f1f5f9" },
            children: [new Paragraph({ children: [new TextRun({ text: "对账周期", bold: true, size: 24 })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: "f1f5f9" },
            children: [new Paragraph({ children: [new TextRun({ text: "入库总金额(元)", bold: true, size: 24 })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: "f1f5f9" },
            children: [new Paragraph({ children: [new TextRun({ text: `应付金额(下浮${reductionRate}%)`, bold: true, size: 24 })], alignment: AlignmentType.CENTER })],
          }),
        ],
      })
    ];

    // Add data rows
    periodData.chartData.forEach(item => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: item.name, alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 } })],
            }),
            new TableCell({
              children: [new Paragraph({ text: item.fmtAmount.toLocaleString(), alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 } })],
            }),
            new TableCell({
              children: [new Paragraph({ text: item.fmtReducedAmount.toLocaleString(), alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 } })],
            }),
          ],
        })
      );
    });

    // Add total row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "f8fafc" },
            children: [new Paragraph({ children: [new TextRun({ text: "年度总计", bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 } })],
          }),
          new TableCell({
            shading: { fill: "f8fafc" },
            children: [new Paragraph({ children: [new TextRun({ text: periodData.totalAll.toFixed(2).toLocaleString(), bold: true, color: "2563eb", size: 24 })], alignment: AlignmentType.CENTER })],
          }),
          new TableCell({
            shading: { fill: "f8fafc" },
            children: [new Paragraph({ children: [new TextRun({ text: periodData.totalReducedAll.toFixed(2).toLocaleString(), bold: true, color: "10b981", size: 24 })], alignment: AlignmentType.CENTER })],
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "食堂财务年度专项审计报告",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 800 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "一、 执行摘要", bold: true, size: 28 }),
              ],
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: `本报告旨在对食堂在记录期内的财务采购数据进行深度审计与总结。系统共计追溯了 ${periodData.chartData.length} 个完整对账周期，覆盖了所有食材入库及出库记录。`,
              spacing: { after: 200 },
              indent: { firstLine: 480 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "二、 核心指标分析", bold: true, size: 28 }),
              ],
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              spacing: { after: 150 },
              children: [
                new TextRun({ text: "1. 采购总量：", bold: true }),
                new TextRun({ text: `累计入库总额达 ` }),
                new TextRun({ text: `¥ ${periodData.totalAll.toLocaleString()}`, bold: true, color: "2563eb" }),
                new TextRun({ text: " 元。" }),
              ],
            }),
            new Paragraph({
              spacing: { after: 150 },
              children: [
                new TextRun({ text: "2. 节省规模：", bold: true }),
                new TextRun({ text: `通过执行 ` }),
                new TextRun({ text: `${reductionRate}%`, bold: true }),
                new TextRun({ text: ` 的下浮政策，累计为单位节约支出 ` }),
                new TextRun({ text: `¥ ${(periodData.totalAll - periodData.totalReducedAll).toLocaleString()}`, bold: true, color: "10b981" }),
                new TextRun({ text: " 元。" }),
              ],
            }),
            new Paragraph({
              spacing: { after: 150 },
              children: [
                new TextRun({ text: "3. 支出峰值：", bold: true }),
                new TextRun({ text: `实际支出（下浮后）最高的周期为 ` }),
                new TextRun({ text: maxPeriod.name, bold: true }),
                new TextRun({ text: `，金额为 ` }),
                new TextRun({ text: `¥ ${maxPeriod.reducedAmount.toLocaleString()}`, bold: true }),
                new TextRun({ text: " 元，超过平均支出水平 " }),
                new TextRun({ text: `${((maxPeriod.reducedAmount / avgReducedAmount - 1) * 100).toFixed(1)}%`, bold: true, color: "ef4444" }),
                new TextRun({ text: "。" }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "三、 周期明细对照表", bold: true, size: 28 }),
              ],
              spacing: { before: 400, after: 400 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "四、 审计结论与建议", bold: true, size: 28 }),
              ],
              spacing: { before: 800, after: 200 },
            }),
            new Paragraph({
              text: "根据历史趋势分析，当前采购价格波动受季节性及供货商下浮政策影响显著。建议后期继续严格执行基准价核查制度，并针对支出峰值周期进行重点货物比价，以进一步优化成本结构。",
              spacing: { after: 400 },
              indent: { firstLine: 480 },
            }),
            new Paragraph({
              spacing: { before: 1200 },
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "财务审计部（系统自动签章）", bold: true, size: 24 }),
              ]
            }),
            new Paragraph({
              spacing: { before: 200 },
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: `报告日期: ${new Date().toLocaleDateString('zh-CN')}`, color: "64748b" })
              ]
            })
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `食堂财务年度专项审计分析报告_${new Date().toISOString().split('T')[0]}.docx`);
  };

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-[#64748b]">
        <Presentation className="w-16 h-16 mb-4 text-[#cbd5e1]" />
        <h2 className="text-lg font-semibold text-[#1e293b] mb-2">暂无对账数据</h2>
        <p>目前还没有任何录入记录，无法生成全年对比总结。</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b] mb-1">全年采购总结</h1>
          <p className="text-sm text-[#64748b]">各对账周期入库采购金额统计与视图分析</p>
        </div>
        <button 
          onClick={exportToWord}
          className="flex items-center gap-2 bg-[#2563eb] text-white px-5 py-2.5 rounded-md font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <FileText className="w-5 h-5" />
          导出为 Word 报告
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mb-6 shrink-0 lg:h-[450px]">
        {/* Left column: Chart View */}
        <div className="flex-1 bg-white rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col p-5 min-h-[400px] lg:min-h-0">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-[#2563eb]" />
            <h2 className="text-lg font-semibold text-[#1e293b]">周期采购趋势视图</h2>
          </div>
          
          <div className="flex-1 min-h-0 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={periodData.chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => `¥${val}`}
                />
                <RechartsTooltip 
                  formatter={(value: number, name: string) => {
                    return [`¥${value.toLocaleString()}`, name];
                  }}
                  labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '4px' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar 
                  dataKey="fmtAmount" 
                  name="入库总额" 
                  fill="#2563eb" 
                  radius={[4, 4, 0, 0]} 
                  barSize={20}
                  animationDuration={1500}
                />
                <Bar 
                  dataKey="fmtReducedAmount" 
                  name={`下浮${reductionRate}%金额`} 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  barSize={20}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column: Data Table and Summary */}
        <div className="w-full lg:w-96 flex flex-col gap-6 shrink-0 h-full">
          {/* Summary Box */}
          <div className="bg-[#0f172a] rounded-2xl shadow-xl p-8 text-white border border-slate-800 relative overflow-hidden flex flex-col gap-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none"></div>
            <div className="relative z-10">
              <h3 className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">入库累计总金额</h3>
              <div className="text-4xl font-display font-bold tracking-tight text-white mb-1">
                {formatCurrency(periodData.totalAll)}
              </div>
              <div className="text-xs text-slate-500 font-medium italic">基于系统全年度入库详细单据汇总</div>
            </div>
            <div className="relative z-10 pt-6 border-t border-slate-800/80">
              <h3 className="text-blue-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">下浮 {reductionRate}% 累计金额</h3>
              <div className="text-3xl font-display font-bold tracking-tight text-emerald-400">
                {formatCurrency(periodData.totalReducedAll)}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-auto">
              ※ 已汇总 {periodData.chartData.length} 个对账周期
            </div>
          </div>

          {/* List Box */}
          <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col flex-1 min-h-0">
            <div className="px-5 py-4 border-b border-[#e2e8f0] shrink-0">
              <h2 className="text-base font-semibold text-[#1e293b]">各周期清单明细</h2>
            </div>
            <div className="p-0 overflow-x-auto overflow-y-auto flex-1 h-0">
              <table className="w-full text-left text-sm min-w-[300px]">
                <thead className="bg-[#f8fafc] sticky top-0 z-10 shadow-sm border-b border-[#e2e8f0]">
                  <tr>
                    <th className="px-4 py-3 font-medium text-[#475569] min-w-[100px]">对账周期</th>
                    <th className="px-4 py-3 font-medium text-[#475569] text-right min-w-[100px]">入库金额</th>
                    <th className="px-4 py-3 font-medium text-[#475569] text-right min-w-[110px]">下浮{reductionRate}%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {periodData.chartData.map((item, i) => (
                    <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-4 py-4 font-medium text-[#334155] whitespace-nowrap">
                        {item.name}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-[#ef4444] whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-[#10b981] whitespace-nowrap">
                        {formatCurrency(item.reducedAmount)}
                      </td>
                    </tr>
                  ))}
                  {periodData.chartData.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-[#94a3b8]">暂无数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Monthly Trend Chart */}
      <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col p-5 shrink-0 h-[400px]">
        <div className="flex items-center gap-2 mb-6 shrink-0">
          <CalendarDays className="w-5 h-5 text-[#10b981]" />
          <h2 className="text-lg font-semibold text-[#1e293b]">每月采购趋势视图</h2>
        </div>
        <div className="flex-1 min-h-0 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
                tickFormatter={(val) => `¥${val}`}
              />
              <RechartsTooltip 
                formatter={(value: number) => [`¥${value.toLocaleString()}`, '当月采购总额']}
                labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '4px' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Line 
                type="monotone" 
                dataKey="fmtAmount" 
                name="每月采购总额" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 4, strokeWidth: 2 }} 
                activeDot={{ r: 6 }} 
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
