import React, { useState, useMemo, useEffect } from 'react';
import { Entry, MonthlyReport } from '../types';
import { FileText, Save, Calculator, Plus, Trash2, Info, ChevronRight, TrendingUp, Download } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, PageOrientation, VerticalAlign, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

function amountToChinese(n: number) {
  if (n === 0) return "零元整";
  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
  n = Math.abs(n);
  let s = '';
  const decimal = Math.round(n * 100) % 100;
  if (decimal > 0) {
    const j = Math.floor(decimal / 10);
    const f = decimal % 10;
    if (j > 0) s += digit[j] + fraction[0];
    if (f > 0) s += digit[f] + fraction[1];
  } else {
    s += '整';
  }
  n = Math.floor(n);
  for (let i = 0; i < unit[0].length && n > 0; i++) {
    let p = '';
    for (let j = 0; j < unit[1].length && n > 0; j++) {
      p = digit[n % 10] + unit[1][j] + p;
      n = Math.floor(n / 10);
    }
    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
  }
  return s.replace(/(零.)*零元/, '元')
    .replace(/(零.)+/g, '零')
    .replace(/^整$/, '零元整');
}

interface Props {
  entries: Entry[];
  reductionRate: number;
  reports: MonthlyReport[];
  onSaveReport: (report: MonthlyReport) => void;
}

export default function MonthlyReportTab({ entries, reductionRate, reports, onSaveReport }: Props) {
  const [activeView, setActiveView] = useState<'detail' | 'summary'>('detail');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月`;
  });

  const [currentReport, setCurrentReport] = useState<MonthlyReport>({
    id: '',
    periodName: '',
    startDate: '',
    endDate: '',
    breakfastCount: 0,
    lunchCount: 0,
    dinnerCount: 0,
    breakfastSubsidy: 10,
    lunchSubsidy: 25,
    dinnerSubsidy: 10,
    guestMealsCount: 0,
    guestMealsRate: 10,
    satisfactionRate: 100,
    totalStaffCount: 170,
    unhappyCount: 0,
    cadreCount: 0,
    staffCount: 0,
    annualContractTotal: 275300,
    lastUpdated: new Date().toISOString()
  });

  useEffect(() => {
    const existing = reports.find(r => r.periodName === selectedPeriod);
    if (existing) {
      setCurrentReport({
        ...existing,
        cadreCount: existing.cadreCount || 0,
        staffCount: existing.staffCount || 0,
        otherBreakfastCount: existing.otherBreakfastCount || 0,
        otherLunchCount: existing.otherLunchCount || 0,
        otherDinnerCount: existing.otherDinnerCount || 0,
        otherBreakfastAmount: existing.otherBreakfastAmount || 0,
        otherLunchAmount: existing.otherLunchAmount || 0,
        otherDinnerAmount: existing.otherDinnerAmount || 0,
      });
    } else {
      setCurrentReport({
        id: Math.random().toString(36).substr(2, 9),
        periodName: selectedPeriod,
        startDate: '',
        endDate: '',
        breakfastCount: 0,
        lunchCount: 0,
        dinnerCount: 0,
        breakfastSubsidy: 10,
        lunchSubsidy: 25,
        dinnerSubsidy: 10,
        guestMealsCount: 0,
        guestMealsRate: 10,
        satisfactionRate: 100,
        totalStaffCount: 170,
        unhappyCount: 0,
        cadreCount: 0,
        staffCount: 0,
        otherBreakfastCount: 0,
        otherLunchCount: 0,
        otherDinnerCount: 0,
        otherBreakfastAmount: 0,
        otherLunchAmount: 0,
        otherDinnerAmount: 0,
        annualContractTotal: 275300,
        lastUpdated: new Date().toISOString()
      });
    }
  }, [selectedPeriod, reports]);

  const stats = useMemo(() => {
    const { 
      breakfastCount = 0, breakfastSubsidy = 10, 
      lunchCount = 0, lunchSubsidy = 25, 
      dinnerCount = 0, dinnerSubsidy = 10,
      guestMealsCount = 0, guestMealsRate = 10,
      totalStaffCount = 170, unhappyCount = 0,
      cadreCount = 0, staffCount = 0,
      otherBreakfastCount = 0, otherLunchCount = 0, otherDinnerCount = 0,
      otherBreakfastAmount = 0, otherLunchAmount = 0, otherDinnerAmount = 0,
      annualContractTotal = 275300
    } = currentReport;

    const match = selectedPeriod.match(/(\d+)年(\d+)月/);
    const filterYear = match ? parseInt(match[1]) : 0;
    const filterMonth = match ? parseInt(match[2]) : 0;
    const daysInMonth = (filterYear && filterMonth) ? new Date(filterYear, filterMonth, 0).getDate() : 30;

    const monthlyEntries = entries.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === filterYear && (d.getMonth() + 1) === filterMonth;
    });

    const vendorProcurementTotal = monthlyEntries.reduce((sum, e) => sum + e.subtotal, 0);
    const vendorPayRate = (100 - reductionRate) / 100;
    const vendorPaymentAmount = vendorProcurementTotal * vendorPayRate;

    // Allocation logic
    const allocationTotalCount = cadreCount + staffCount;
    let cadreAmount = 0;
    let staffAmount = 0;
    if (allocationTotalCount > 0) {
      cadreAmount = Number((vendorPaymentAmount * (cadreCount / allocationTotalCount)).toFixed(2));
      staffAmount = Number((vendorPaymentAmount - cadreAmount).toFixed(2));
    }

    const breakfastTotal = breakfastCount * breakfastSubsidy;
    const lunchTotal = lunchCount * lunchSubsidy;
    const dinnerTotal = dinnerCount * dinnerSubsidy;
    const mealsTotal = breakfastTotal + lunchTotal + dinnerTotal;
    
    const guestTotal = guestMealsCount * guestMealsRate;
    
    const otherTotalAmount = otherBreakfastAmount + otherLunchAmount + otherDinnerAmount;
    const otherTotalCount = otherBreakfastCount + otherLunchCount + otherDinnerCount;

    const monthlyContractBaseVal = annualContractTotal / 12;
    const serviceFeeBasePortionVal = monthlyContractBaseVal * 0.85; 
    const serviceFeeIncentivePoolVal = monthlyContractBaseVal * 0.15;
    
    const calculatedSatisfaction = totalStaffCount > 0 ? ((totalStaffCount - unhappyCount) / totalStaffCount * 100) : 100;
    const incentivePayoutVal = serviceFeeIncentivePoolVal * (calculatedSatisfaction / 100);
    
    const grandTotal = mealsTotal + serviceFeeBasePortionVal + incentivePayoutVal + guestTotal + vendorPaymentAmount + otherTotalAmount;

    // Ingredient Stats Calculation
    const ingredientMap: Record<string, number> = {};
    monthlyEntries.forEach(e => {
      if (!ingredientMap[e.productName]) ingredientMap[e.productName] = 0;
      ingredientMap[e.productName] += (e.subtotal || (e.quantity * e.price)) * vendorPayRate;
    });

    const ingredientStats = Object.keys(ingredientMap).map(name => {
      const totalCostAfterDiscount = ingredientMap[name];
      const costProportion = vendorPaymentAmount > 0 ? (totalCostAfterDiscount / vendorPaymentAmount) * 100 : 0;
      const perCapitaDailyCost = (allocationTotalCount > 0 && daysInMonth > 0) 
        ? totalCostAfterDiscount / (allocationTotalCount * daysInMonth) 
        : 0;
      return { name, totalCostAfterDiscount, perCapitaDailyCost, costProportion };
    }).sort((a, b) => b.totalCostAfterDiscount - a.totalCostAfterDiscount);

    const totalPerCapitaDailyCost = ingredientStats.reduce((sum, item) => sum + item.perCapitaDailyCost, 0);
    const top3Ingredients = ingredientStats.slice(0, 3);

    return {
      breakfastTotal,
      lunchTotal,
      dinnerTotal,
      mealsTotal,
      guestTotal,
      otherTotalAmount,
      otherTotalCount,
      monthlyContractBase: monthlyContractBaseVal,
      serviceFeeBasePortion: serviceFeeBasePortionVal,
      serviceFeeIncentivePool: serviceFeeIncentivePoolVal,
      satisfactionRate: calculatedSatisfaction,
      incentivePayout: incentivePayoutVal,
      vendorProcurementTotal,
      vendorPaymentAmount,
      vendorPayRate: vendorPayRate * 100,
      allocationTotalCount,
      cadreAmount,
      staffAmount,
      grandTotal,
      ingredientStats,
      totalPerCapitaDailyCost,
      top3Ingredients
    };
  }, [currentReport, entries, selectedPeriod, reductionRate]);


  const handleInputChange = (field: keyof MonthlyReport, value: any) => {
    setCurrentReport(prev => {
      const next = { ...prev, [field]: value, lastUpdated: new Date().toISOString() };
      
      // Keep satisfactionRate in sync with counts if they changed
      if (field === 'totalStaffCount' || field === 'unhappyCount') {
        next.satisfactionRate = next.totalStaffCount > 0 
          ? ((next.totalStaffCount - next.unhappyCount) / next.totalStaffCount * 100) 
          : 100;
      }

      // Auto-calculate allocation counts based on 70/30 split of total meal counts
      if (field === 'breakfastCount' || field === 'lunchCount' || field === 'dinnerCount') {
        const totalMeals = (next.breakfastCount || 0) + (next.lunchCount || 0) + (next.dinnerCount || 0);
        next.cadreCount = Math.round(totalMeals * 0.7);
        next.staffCount = totalMeals - next.cadreCount;
      }
      
      return next;
    });
  };
  const saveReport = () => {
    onSaveReport(currentReport);
    alert('报表数据已保存到本地。');
  };

  const exportAllocationToExcel = () => {
    const { periodName, cadreCount = 0, staffCount = 0 } = currentReport;
    const { vendorPaymentAmount, allocationTotalCount, cadreAmount, staffAmount } = stats;

    const data = [
      [`${periodName}职工食堂就餐人员费用分配表`, null, null, null, null, null, null, null],
      ['月份', '总金额（下浮自然月）（元）', '打卡人次（手动录入）', '补贴金额（元）= 总金额', '干部人次', '干部金额（元）', '职工人次', '职工金额（元）'],
      [periodName, vendorPaymentAmount.toFixed(2), allocationTotalCount, vendorPaymentAmount.toFixed(2), cadreCount, cadreAmount.toFixed(2), staffCount, staffAmount.toFixed(2)],
      [null],
      ['分管领导：', null, '办公室主任：', null, '统计：', null, '制表：']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Auto-fit column widths (basic adjustment)
    const wscols = [
      {wch: 15}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 10}, {wch: 15}
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "费用分配");
    XLSX.writeFile(wb, `${periodName}职工食堂就餐人员费用分配表.xlsx`);
  };

  const exportSummaryToExcel = () => {
    const data = [
      ['餐饮服务费奖励标准'],
      ['月份', '总额', '客饭', '基本服务费', '奖励部分', '奖励比例', '奖励金额', '服务费总额'],
    ];

    let totalMonthlyCumulative = 0;
    let totalGuestCumulative = 0;
    let totalBasicCumulative = 0;
    let totalRewardPartCumulative = 0;
    let totalRewardAmountCumulative = 0;
    let totalFeeCumulative = 0;
    
    // Sort reports by date
    const sortedReports = [...reports].sort((a, b) => {
      const parse = (p: string) => {
        const m = p.match(/(\d+)年(\d+)月/);
        return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : 0;
      };
      return parse(a.periodName) - parse(b.periodName);
    });

    sortedReports.forEach(r => {
      const monthlyTotal = r.annualContractTotal / 12;
      const guestMeals = r.guestMealsCount * r.guestMealsRate;
      const basicFee = monthlyTotal * 0.85;
      const rewardPart = monthlyTotal * 0.15;
      const satisfaction = r.satisfactionRate;
      const rewardAmount = rewardPart * (satisfaction / 100);
      const totalFee = guestMeals + basicFee + rewardAmount;
      
      totalMonthlyCumulative += monthlyTotal;
      totalGuestCumulative += guestMeals;
      totalBasicCumulative += basicFee;
      totalRewardPartCumulative += rewardPart;
      totalRewardAmountCumulative += rewardAmount;
      totalFeeCumulative += totalFee;

      data.push([
        r.periodName,
        monthlyTotal.toFixed(2),
        guestMeals.toFixed(2),
        basicFee.toFixed(2),
        rewardPart.toFixed(2),
        `${satisfaction.toFixed(2)}%`,
        rewardAmount.toFixed(2),
        totalFee.toFixed(2)
      ]);
    });

    // Add Total Row
    data.push([
      '合计',
      totalMonthlyCumulative.toFixed(2),
      totalGuestCumulative.toFixed(2),
      totalBasicCumulative.toFixed(2),
      totalRewardPartCumulative.toFixed(2),
      '-',
      totalRewardAmountCumulative.toFixed(2),
      totalFeeCumulative.toFixed(2)
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "服务费奖励汇总");
    XLSX.writeFile(wb, "餐饮服务费奖励标准汇总.xlsx");
  };

  const exportToExcel = () => {
    const { periodName } = currentReport;
    const { 
      breakfastTotal, lunchTotal, dinnerTotal, mealsTotal, 
      serviceFeeBasePortion, incentivePayout, guestTotal, vendorPaymentAmount, grandTotal 
    } = stats;

    const data = [
      [`职工食堂${periodName}运行情况统计表`, null, null, null, null, null],
      [null, null, null, null, null, `金额单位：（元）`],
      ['项目', null, '人数', '打卡标准', '打卡金额', '补贴金额合计'],
      ['工作日餐补', '早餐', currentReport.breakfastCount, 0, 0, breakfastTotal.toFixed(2)],
      [null, '午餐', currentReport.lunchCount, 0, 0, lunchTotal.toFixed(2)],
      [null, '晚餐', currentReport.dinnerCount, 0, 0, dinnerTotal.toFixed(2)],
      [null, '合计', currentReport.breakfastCount + currentReport.lunchCount + currentReport.dinnerCount, null, null, mealsTotal.toFixed(2)],
      ['其他工作人员', '早餐', currentReport.otherBreakfastCount, null, null, currentReport.otherBreakfastAmount?.toFixed(2)],
      [null, '午餐', currentReport.otherLunchCount, null, null, currentReport.otherLunchAmount?.toFixed(2)],
      [null, '晚餐', currentReport.otherDinnerCount, null, null, currentReport.otherDinnerAmount?.toFixed(2)],
      [null, '收款小计', stats.otherTotalCount, null, null, stats.otherTotalAmount.toFixed(2)],
      ['当月固定支出', '基本餐饮服务费', currentReport.annualContractTotal, (stats.monthlyContractBase).toFixed(2), (stats.serviceFeeIncentivePool).toFixed(2), serviceFeeBasePortion.toFixed(2)],
      [null, '餐饮服务费奖励', `${currentReport.unhappyCount}人`, null, `${stats.satisfactionRate.toFixed(2)}%`, incentivePayout.toFixed(2)],
      [null, '客饭服务费', currentReport.guestMealsCount, null, currentReport.guestMealsRate, guestTotal.toFixed(2)],
      [null, '下浮支付金额', null, null, null, vendorPaymentAmount.toFixed(2)],
      ['合计', null, null, null, 0, grandTotal.toFixed(2)],
      ['食堂总支出', amountToChinese(grandTotal), null, null, null, grandTotal.toFixed(2)],
      ['统计', `1、年度餐饮服务费${currentReport.annualContractTotal}元，月服务费${stats.monthlyContractBase.toFixed(2)}元，其中85%计${serviceFeeBasePortion.toFixed(2)}元为基本餐饮服务费，15%计${stats.serviceFeeIncentivePool.toFixed(2)}按满意度比例奖励，本月全员就餐人数${currentReport.totalStaffCount}人，不满意测评${currentReport.unhappyCount}人，占${(100 - stats.satisfactionRate).toFixed(2)}%，满意度${stats.satisfactionRate.toFixed(2)}%奖励金额${incentivePayout.toFixed(2)}元。 2、伙食补贴金额费用，供货方供货金额${stats.vendorProcurementTotal.toFixed(2)}元，按${stats.vendorPayRate.toFixed(2)}%支付费用共计${vendorPaymentAmount.toFixed(2)}元。 3、其他工作人员缴费人数${stats.otherTotalCount}人次，缴纳金额合计${stats.otherTotalAmount.toFixed(2)}元。`]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "运行统计");
    XLSX.writeFile(wb, `食堂运营统计_${periodName}.xlsx`);
  };

  const exportToWord = async () => {
    const { periodName } = currentReport;
    const { 
      breakfastTotal, lunchTotal, dinnerTotal, mealsTotal, 
      serviceFeeBasePortion, incentivePayout, guestTotal, vendorPaymentAmount, grandTotal 
    } = stats;

    const bRatio = mealsTotal > 0 ? breakfastTotal / mealsTotal : 0;
    const lRatio = mealsTotal > 0 ? lunchTotal / mealsTotal : 0;
    const dRatio = mealsTotal > 0 ? dinnerTotal / mealsTotal : 0;

    const diff = vendorPaymentAmount - mealsTotal;
    const isOver = diff > 0;
    const totalMealsCount = currentReport.breakfastCount + currentReport.lunchCount + currentReport.dinnerCount;
    const avgSubsidy = totalMealsCount > 0 ? mealsTotal / totalMealsCount : 0;

    const budgetStatusDesc = isOver 
      ? `本月餐补基准标准总计为 ${mealsTotal.toFixed(2)} 元，而供应商实际结算金额为 ${vendorPaymentAmount.toFixed(2)} 元，整体呈现“超支”状态，偏差额为 ${diff.toFixed(2)} 元。请相关部门关注采购成本波动。`
      : `本月餐补基准标准总计为 ${mealsTotal.toFixed(2)} 元，供应商实际结算金额为 ${vendorPaymentAmount.toFixed(2)} 元，整体处于“受控”状态，本月节约预算 ${(Math.abs(diff)).toFixed(2)} 元。`;

    const perCapitaDesc = `全月早中晚累计保障就餐总人次为 ${totalMealsCount} 人次，平均每餐次补贴标准为 ${avgSubsidy.toFixed(2)} 元。`;

    // Calculate details for meal periods
    const mealDetails = [
      { name: "早餐", count: currentReport.breakfastCount, total: breakfastTotal },
      { name: "午餐", count: currentReport.lunchCount, total: lunchTotal },
      { name: "晚餐", count: currentReport.dinnerCount, total: dinnerTotal },
    ].map(m => {
      const shareOfOverspent = isOver ? (m.total / mealsTotal) * diff : 0;
      const actualCost = m.total + shareOfOverspent;
      return { ...m, shareOfOverspent, actualCost };
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [
          // Header
          new Paragraph({
            children: [new TextRun({ text: `职工食堂运营多维度总结报告`, size: 48, bold: true, color: "2D3E50" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `报表期次：`, bold: true }),
              new TextRun({ text: periodName }),
              new TextRun({ text: "    " }),
              new TextRun({ text: `生成日期：`, bold: true }),
              new TextRun({ text: new Date().toLocaleDateString() }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
          }),

          // Section 1: 运营概况
          new Paragraph({
            children: [new TextRun({ text: "一、运营核心指标概况", size: 32, bold: true, color: "1E40AF" })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "本统计周期内，食堂运行平稳。全月累计总支出金额为 " }),
              new TextRun({ text: grandTotal.toFixed(2), bold: true, color: "B91C1C" }),
              new TextRun({ text: " 元（大写：" }),
              new TextRun({ text: amountToChinese(grandTotal), bold: true }),
              new TextRun({ text: "）。本期结算严格依据合同条款进行，各项扣率及服务费核算准确。" }),
            ],
            spacing: { before: 200, after: 200 },
            alignment: AlignmentType.JUSTIFIED,
          }),

          // Section 2: 就餐维度分析
          new Paragraph({
            children: [new TextRun({ text: "二、多维度就餐人次分析", size: 32, bold: true, color: "1E40AF" })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1. 就餐时段分布：", bold: true }),
            ],
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `• 早餐累积：${currentReport.breakfastCount} 人次，总金额 ${breakfastTotal.toFixed(2)} 元` }),
            ],
            indent: { left: 720 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `• 午餐累积：${currentReport.lunchCount} 人次，总金额 ${lunchTotal.toFixed(2)} 元` }),
            ],
            indent: { left: 720 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `• 晚餐累积：${currentReport.dinnerCount} 人次，总金额 ${dinnerTotal.toFixed(2)} 元` }),
            ],
            indent: { left: 720 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `• 客饭服务：${currentReport.guestMealsCount} 人次，服务费金额 ${guestTotal.toFixed(2)} 元` }),
            ],
            indent: { left: 720 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `汇总：全月累计保障就餐 `, bold: true }),
              new TextRun({ text: (currentReport.breakfastCount + currentReport.lunchCount + currentReport.dinnerCount).toString(), bold: true, color: "1E40AF" }),
              new TextRun({ text: " 人次，餐补总额 " }),
              new TextRun({ text: mealsTotal.toFixed(2), bold: true }),
              new TextRun({ text: " 元。" }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "2. 其他工作人员收款：", bold: true }),
            ],
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `本月其他工作人员累计就餐 ${stats.otherTotalCount} 人次，共计缴纳伙食费 ` }),
              new TextRun({ text: stats.otherTotalAmount.toFixed(2), bold: true, color: "047857" }),
              new TextRun({ text: " 元。其中：早餐收款 " }),
              new TextRun({ text: (currentReport.otherBreakfastAmount || 0).toFixed(2) }),
              new TextRun({ text: " 元，午餐收款 " }),
              new TextRun({ text: (currentReport.otherLunchAmount || 0).toFixed(2) }),
              new TextRun({ text: " 元，晚餐收款 " }),
              new TextRun({ text: (currentReport.otherDinnerAmount || 0).toFixed(2) }),
              new TextRun({ text: " 元。" }),
            ],
            spacing: { after: 200 },
          }),

          // Section 3: 服务与满意度
          new Paragraph({
            children: [new TextRun({ text: "三、服务质量评价与激励体系", size: 32, bold: true, color: "1E40AF" })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `依据${currentReport.annualContractTotal}元年度餐饮合同，本期参与满意度测评总人数为 ` }),
              new TextRun({ text: currentReport.totalStaffCount.toString(), bold: true }),
              new TextRun({ text: " 人。其中不满意测评 " }),
              new TextRun({ text: currentReport.unhappyCount.toString(), bold: true }),
              new TextRun({ text: ` 人，满意度比例为 ` }),
              new TextRun({ text: stats.satisfactionRate.toFixed(2) + "%", bold: true, color: stats.satisfactionRate >= 90 ? "047857" : "B91C1C" }),
              new TextRun({ text: "。" }),
            ],
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "服务费核算细目：", bold: true }),
            ],
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `• 基础服务费（合同额85%）：${serviceFeeBasePortion.toFixed(2)} 元` }),
            ],
            indent: { left: 720 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `• 满意度奖励金（实发部分）：${incentivePayout.toFixed(2)} 元` }),
            ],
            indent: { left: 720 },
          }),

          // Section 4: 费用承担与人员分配维度
          new Paragraph({
            children: [new TextRun({ text: "四、费用承担与人员分配维度", size: 32, bold: true, color: "1E40AF" })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1. 预算执行说明：", bold: true }),
              new TextRun({ text: budgetStatusDesc, color: isOver ? "B91C1C" : "047857" }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "餐次", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                  new TableCell({ children: [new Paragraph({ text: "就餐人次", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                  new TableCell({ children: [new Paragraph({ text: "标准总额", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                  new TableCell({ children: [new Paragraph({ text: "分摊结算额", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                  new TableCell({ children: [new Paragraph({ text: "状态", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                ]
              }),
              ...mealDetails.map(m => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: m.name })] }),
                  new TableCell({ children: [new Paragraph({ text: m.count.toString(), alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: m.total.toFixed(2), alignment: AlignmentType.RIGHT })] }),
                  new TableCell({ children: [new Paragraph({ text: m.actualCost.toFixed(2), alignment: AlignmentType.RIGHT })] }),
                  new TableCell({ children: [new Paragraph({ text: m.shareOfOverspent > 0 ? "超支" : "受控", alignment: AlignmentType.CENTER, children: [new TextRun({ text: m.shareOfOverspent > 0 ? "超支" : "受控", color: m.shareOfOverspent > 0 ? "B91C1C" : "047857" })] })] }),
                ]
              })),
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "2. 人均标准：", bold: true }),
              new TextRun({ text: perCapitaDesc }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3. 费用分摊细目：", bold: true }),
              new TextRun({ text: "按照食堂人次分配原则（70:30），并依据早中晚餐补权重进行二次比例分配，本月费用分摊如下：" }),
            ],
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: "类别", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                  new TableCell({ children: [new Paragraph({ text: "分摊汇总", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                  new TableCell({ children: [new Paragraph({ text: "早餐分配", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                  new TableCell({ children: [new Paragraph({ text: "午餐分配", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                  new TableCell({ children: [new Paragraph({ text: "晚餐分配", alignment: AlignmentType.CENTER })], shading: { fill: "F8FAFC" } }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ 
                    children: [new Paragraph({ text: "干部人次 (70%)" })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                  new TableCell({ 
                    children: [new Paragraph({ text: stats.cadreAmount.toFixed(2), alignment: AlignmentType.RIGHT })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                  new TableCell({ 
                    children: [new Paragraph({ text: (stats.cadreAmount * bRatio).toFixed(2), alignment: AlignmentType.RIGHT })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                  new TableCell({ 
                    children: [new Paragraph({ text: (stats.cadreAmount * lRatio).toFixed(2), alignment: AlignmentType.RIGHT })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                  new TableCell({ 
                    children: [new Paragraph({ text: (stats.cadreAmount * dRatio).toFixed(2), alignment: AlignmentType.RIGHT })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ 
                    children: [new Paragraph({ text: "职工人次 (30%)" })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                  new TableCell({ 
                    children: [new Paragraph({ text: stats.staffAmount.toFixed(2), alignment: AlignmentType.RIGHT })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                  new TableCell({ 
                    children: [new Paragraph({ text: (stats.staffAmount * bRatio).toFixed(2), alignment: AlignmentType.RIGHT })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                  new TableCell({ 
                    children: [new Paragraph({ text: (stats.staffAmount * lRatio).toFixed(2), alignment: AlignmentType.RIGHT })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                  new TableCell({ 
                    children: [new Paragraph({ text: (stats.staffAmount * dRatio).toFixed(2), alignment: AlignmentType.RIGHT })], 
                    verticalAlign: VerticalAlign.CENTER 
                  }),
                ]
              }),
            ]
          }),

          // Section 5: 供应商核算
          new Paragraph({
            children: [new TextRun({ text: "五、供应商货款结算分析", size: 32, bold: true, color: "1E40AF" })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `本统计周期内，供货方（供应商）实际供货金额累计为 ` }),
              new TextRun({ text: stats.vendorProcurementTotal.toFixed(2), bold: true }),
              new TextRun({ text: " 元。经审定，依照 " }),
              new TextRun({ text: stats.vendorPayRate.toFixed(2) + "%", bold: true }),
              new TextRun({ text: ` 的比例进行货款及下浮费支付，最终应付供货方金额为 ` }),
              new TextRun({ text: vendorPaymentAmount.toFixed(2), bold: true, color: "B91C1C" }),
              new TextRun({ text: " 元。" }),
            ],
            spacing: { before: 200 },
          }),

          // Section 6: 食材成本多维度分析
          new Paragraph({
            children: [new TextRun({ text: "六、食材成本多维度分析", size: 32, bold: true, color: "1E40AF" })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "考虑到服务执行自然月天数及各项食材下浮金额与日用餐密度的关系，本月各维度指标如下（周排菜预算参考）：" }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `综合测算当月总人均单日成本基准分项值为：`, bold: true }),
              new TextRun({ text: stats.totalPerCapitaDailyCost.toFixed(2), bold: true, color: "B91C1C", size: 28 }),
              new TextRun({ text: " 元/人·日" }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "成本总计占比最高（支出最大化）的前三类核心食材成本负荷计算明细：" }),
            ],
            spacing: { after: 200 },
          }),
          ...stats.top3Ingredients.map((item, idx) => 
            new Paragraph({
              children: [
                new TextRun({ text: `TOP ${idx + 1} - ${item.name}`, bold: true, color: "1E40AF" }),
                new TextRun({ text: ` (月折后下浮拨付额: ¥${item.totalCostAfterDiscount.toFixed(2)} | 人均日指标负担: ¥${item.perCapitaDailyCost.toFixed(2)} | 月采购结构占比: ${item.costProportion.toFixed(2)}%)` })
              ],
              indent: { left: 720 },
              spacing: { after: 100 },
            })
          ),
          
          // Signatures
          new Paragraph({
            children: [
              new TextRun({ text: "（报告结束）" })
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 1000, after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "分管领导：                      办公室主任：                     统计人：                    报告制表：" })
            ],
            spacing: { before: 400 },
          })
        ],
      }],
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, `食堂维度总结报告_${periodName}.docx`);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">月运行情况统计</h1>
            <div className="flex p-1 bg-slate-100 rounded-lg">
              <button 
                onClick={() => setActiveView('detail')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeView === 'detail' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                月度详情录入
              </button>
              <button 
                onClick={() => setActiveView('summary')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeView === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                服务费奖励汇总表
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500">依据合同约定自动核算服务费、奖励金及各项餐补</p>
        </div>
        <div className="flex items-center gap-3">
          {activeView === 'detail' ? (
            <>
              <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-3">选择期次</span>
                <input 
                  type="month" 
                  className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-900"
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-');
                    setSelectedPeriod(`${y}年${m}月`);
                  }}
                />
              </div>
              <button 
                onClick={saveReport}
                className="flex items-center gap-2 bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-900/10 active:scale-95"
              >
                <Save className="w-4 h-4" />
                保存当前数据
              </button>
              <button 
                onClick={exportAllocationToExcel}
                className="flex items-center space-x-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-slate-950 rounded-xl transition-all font-bold shadow-lg shadow-orange-900/10 active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>导出分配表 Excel</span>
              </button>
              <button 
                onClick={exportToExcel}
                className="flex items-center space-x-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-slate-950 rounded-xl transition-all font-bold shadow-lg shadow-green-900/10 active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>运行统计报表</span>
              </button>
              <button 
                onClick={exportToWord}
                className="flex items-center gap-2 bg-blue-600 text-slate-950 px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/10 active:scale-95"
              >
                <FileText className="w-4 h-4" />
                全新多维度总结报告
              </button>
            </>
          ) : (
            <button 
              onClick={exportSummaryToExcel}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-950 rounded-xl transition-all font-bold shadow-lg shadow-blue-900/10 active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>导出奖励标准汇总 Excel</span>
            </button>
          )}
        </div>
      </header>

      {activeView === 'detail' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Left: Input Form */}
        <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto pr-2">
          {/* Meal Statistics */}
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#1e293b] mb-4 flex items-center">
              <Calculator className="h-5 w-5 mr-2 text-[#2563eb]" />
              工作日餐补录入
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-[#64748b]">早餐人数 (人)</label>
                  <input 
                    type="number"
                    value={currentReport.breakfastCount || ''}
                    onChange={(e) => handleInputChange('breakfastCount', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-[#64748b]">早餐标准 (元)</label>
                  <input 
                    type="number"
                    value={currentReport.breakfastSubsidy}
                    onChange={(e) => handleInputChange('breakfastSubsidy', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-[#64748b]">午餐人数 (人)</label>
                  <input 
                    type="number"
                    value={currentReport.lunchCount || ''}
                    onChange={(e) => handleInputChange('lunchCount', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-[#64748b]">午餐标准 (元)</label>
                  <input 
                    type="number"
                    value={currentReport.lunchSubsidy}
                    onChange={(e) => handleInputChange('lunchSubsidy', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-[#64748b]">晚餐人数 (人)</label>
                  <input 
                    type="number"
                    value={currentReport.dinnerCount || ''}
                    onChange={(e) => handleInputChange('dinnerCount', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-[#64748b]">晚餐标准 (元)</label>
                  <input 
                    type="number"
                    value={currentReport.dinnerSubsidy}
                    onChange={(e) => handleInputChange('dinnerSubsidy', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 mb-3">其他工作人员 (收款项目)</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">早餐人数</label>
                      <input 
                        type="number"
                        value={currentReport.otherBreakfastCount || ''}
                        onChange={(e) => handleInputChange('otherBreakfastCount', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#e2e8f0] outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">早餐收款 (元)</label>
                      <input 
                        type="number"
                        value={currentReport.otherBreakfastAmount || ''}
                        onChange={(e) => handleInputChange('otherBreakfastAmount', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#e2e8f0] outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">午餐人数</label>
                      <input 
                        type="number"
                        value={currentReport.otherLunchCount || ''}
                        onChange={(e) => handleInputChange('otherLunchCount', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#e2e8f0] outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">午餐收款 (元)</label>
                      <input 
                        type="number"
                        value={currentReport.otherLunchAmount || ''}
                        onChange={(e) => handleInputChange('otherLunchAmount', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#e2e8f0] outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">晚餐人数</label>
                      <input 
                        type="number"
                        value={currentReport.otherDinnerCount || ''}
                        onChange={(e) => handleInputChange('otherDinnerCount', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#e2e8f0] outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">晚餐收款 (元)</label>
                      <input 
                        type="number"
                        value={currentReport.otherDinnerAmount || ''}
                        onChange={(e) => handleInputChange('otherDinnerAmount', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-[#e2e8f0] outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#1e293b] mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-[#2563eb]" />
              服务评价与固定支出
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">测评总人数</label>
                <input 
                  type="number"
                  value={currentReport.totalStaffCount}
                  onChange={(e) => handleInputChange('totalStaffCount', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">不满意人数 (人)</label>
                <input 
                  type="number"
                  value={currentReport.unhappyCount}
                  onChange={(e) => handleInputChange('unhappyCount', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">客饭服务人数</label>
                <input 
                  type="number"
                  value={currentReport.guestMealsCount}
                  onChange={(e) => handleInputChange('guestMealsCount', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">合同年总额 (元)</label>
                <input 
                  type="number"
                  value={currentReport.annualContractTotal}
                  onChange={(e) => handleInputChange('annualContractTotal', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-[#2563eb] outline-none"
                />
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2"></div>
                费用分配数据（分配表）
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <label className="block text-slate-500">干部人次 (人)</label>
                  <input 
                    type="number"
                    value={currentReport.cadreCount || ''}
                    onChange={(e) => handleInputChange('cadreCount', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-slate-500">职工人次 (人)</label>
                  <input 
                    type="number"
                    value={currentReport.staffCount || ''}
                    onChange={(e) => handleInputChange('staffCount', parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg border border-[#e2e8f0] focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="mt-4 p-3 bg-orange-50 rounded-lg text-orange-800 font-medium">
                分配总人次：{stats.allocationTotalCount} 人
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 font-medium">满意度百分比：</span>
                <span className="text-lg font-bold text-blue-900">{stats.satisfactionRate.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-blue-700 font-medium">奖励金池分摊：</span>
                <span className="text-sm font-bold text-blue-900">¥{stats.incentivePayout.toFixed(2)} / ¥{stats.serviceFeeIncentivePool.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Preview Panel */}
        <div className="lg:col-span-2 overflow-y-auto">
          <div className="bg-[#1e293b] rounded-xl p-8 text-white shadow-lg">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
              <h3 className="text-xl font-bold flex items-center">
                <FileText className="h-6 w-6 mr-3 text-blue-400" />
                运行情况统计预览 ({selectedPeriod})
              </h3>
              <div className="px-3 py-1 bg-blue-500/20 rounded-full text-xs font-bold text-blue-300 border border-blue-500/30">
                PROVISIONAL REPORT
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">餐次统计</h4>
                <div className="flex justify-between items-center text-sm py-2 border-b border-white/5">
                  <span className="text-slate-400">早餐人次 ({currentReport.breakfastCount})</span>
                  <span className="font-mono">¥{stats.breakfastTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm py-2 border-b border-white/5">
                  <span className="text-slate-400">午餐人次 ({currentReport.lunchCount})</span>
                  <span className="font-mono">¥{stats.lunchTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm py-2 border-b border-white/5">
                  <span className="text-slate-400">晚餐人次 ({currentReport.dinnerCount})</span>
                  <span className="font-mono">¥{stats.dinnerTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-white pt-2">
                  <span>餐补小计</span>
                  <span className="font-mono">¥{stats.mealsTotal.toFixed(2)}</span>
                </div>
                
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-6 mb-2">其他工作人员 (收款)</h4>
                <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-slate-400">早餐 ({currentReport.otherBreakfastCount}人次)</span>
                  <span className="font-mono text-emerald-400">¥{currentReport.otherBreakfastAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-slate-400">午餐 ({currentReport.otherLunchCount}人次)</span>
                  <span className="font-mono text-emerald-400">¥{currentReport.otherLunchAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm py-1 border-b border-white/5 pb-2">
                  <span className="text-slate-400">晚餐 ({currentReport.otherDinnerCount}人次)</span>
                  <span className="font-mono text-emerald-400">¥{currentReport.otherDinnerAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-emerald-400 pt-2">
                  <span>收款合计</span>
                  <span className="font-mono">¥{stats.otherTotalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">固定支出与奖励</h4>
                <div className="flex justify-between items-center text-sm py-2 border-b border-white/5">
                  <span className="text-slate-400">月基础服务费 (85%)</span>
                  <span className="font-mono">¥{stats.serviceFeeBasePortion.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm py-2 border-b border-white/5">
                  <div className="flex flex-col">
                    <span className="text-slate-400">满意度绩效奖励</span>
                    <span className="text-[10px] text-green-400">评分: {stats.satisfactionRate.toFixed(1)}%</span>
                  </div>
                  <span className="font-mono text-green-400">¥{stats.incentivePayout.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm py-2 border-b border-white/5">
                  <span className="text-slate-400">客饭服务费合计</span>
                  <span className="font-mono">¥{stats.guestTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-white pt-2">
                  <span>服务类小计</span>
                  <span className="font-mono">¥{(stats.serviceFeeBasePortion + stats.incentivePayout + stats.guestTotal).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-12 bg-white/5 rounded-2xl p-6 border border-white/10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16"></div>
               
               <div className="relative">
                <div className="flex items-start justify-between mb-6">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">食材采购结算 (下浮支付)</h4>
                    <p className="text-[10px] text-slate-400">计算逻辑: 采购原价 ¥{stats.vendorProcurementTotal.toFixed(2)} × 支付比例 {stats.vendorPayRate.toFixed(1)}%</p>
                  </div>
                  <div className="text-xl font-mono font-bold text-blue-300">¥{stats.vendorPaymentAmount.toFixed(2)}</div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">应付总支出合计</span>
                    <span className="text-xs font-medium text-slate-500">PERIOD TOTAL</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex-1 mr-8">
                       <div className="text-xs text-slate-500 mb-1">中文大写（CNY）</div>
                       <div className="text-sm font-medium text-blue-200 bg-blue-500/10 inline-block px-3 py-1 rounded border border-blue-500/20">{amountToChinese(stats.grandTotal)}</div>
                    </div>
                    <div className="text-4xl font-mono font-bold text-white tracking-tighter">
                      <span className="text-2xl mr-1 opacity-50 font-sans tracking-normal">¥</span>
                      {stats.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-white/5 rounded-2xl p-6 border border-white/10">
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center">
                <Calculator className="w-4 h-4 mr-2" />
                食材成本细分维度分析 (人均日成本依据)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs text-slate-400 mb-2">综合整体总人均单日食材拨付成本</div>
                  <div className="text-4xl font-mono font-bold text-red-400 flex items-baseline">
                    <span className="text-2xl mr-1">¥</span>
                    {stats.totalPerCapitaDailyCost.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2 leading-relaxed">基于计算：当前月份下浮后实付成本 ÷<br/>(汇总分配人次 × 对账月自然天数)<br/>*此值将用作 AI 生成智能周菜谱及采购预算预估强约束标准。</div>
                </div>
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">支出占比及成本最高 TOP3 食材</div>
                  {stats.top3Ingredients.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-black text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200 text-sm">{item.name}</div>
                          <div className="text-[10px] text-slate-400">总体占比: {item.costProportion.toFixed(2)}%</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-emerald-400 font-bold">¥{item.perCapitaDailyCost.toFixed(2)}</div>
                        <div className="text-[9px] text-slate-500">人/日</div>
                      </div>
                    </div>
                  ))}
                  {stats.top3Ingredients.length === 0 && (
                    <div className="text-sm text-slate-500 italic py-2">暂无符合条件的月度支出明细供计算。</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-4 gap-4 opacity-30 text-[10px] uppercase font-bold tracking-widest">
              <div>分管领导: ______</div>
              <div>办公室主任: ______</div>
              <div>统计: ______</div>
              <div>制表: ______</div>
            </div>
          </div>
        </div>
      </div>
    ) : (
        <div className="flex-1 overflow-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">餐饮服务费奖励标准</h2>
            <table className="w-full border-collapse border border-slate-300 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border border-slate-300 px-4 py-2 font-bold text-slate-700">月份</th>
                  <th className="border border-slate-300 px-4 py-2 font-bold text-slate-700">总额</th>
                  <th className="border border-slate-300 px-4 py-2 font-bold text-slate-700">客饭</th>
                  <th className="border border-slate-300 px-4 py-2 font-bold text-slate-700">基本服务费</th>
                  <th className="border border-slate-300 px-4 py-2 font-bold text-slate-700">奖励部分</th>
                  <th className="border border-slate-300 px-4 py-2 font-bold text-slate-700">奖励比例</th>
                  <th className="border border-slate-300 px-4 py-2 font-bold text-slate-700">奖励金额</th>
                  <th className="border border-slate-300 px-4 py-2 font-bold text-slate-700">服务费总额</th>
                </tr>
              </thead>
              <tbody>
                {reports.slice().sort((a, b) => {
                  const parse = (p: string) => {
                    const m = p.match(/(\d+)年(\d+)月/);
                    return m ? parseInt(m[1]) * 100 + parseInt(m[2]) : 0;
                  };
                  return parse(a.periodName) - parse(b.periodName);
                }).map(r => {
                  const monthlyTotal = r.annualContractTotal / 12;
                  const guestMeals = r.guestMealsCount * r.guestMealsRate;
                  const basicFee = monthlyTotal * 0.85;
                  const rewardPart = monthlyTotal * 0.15;
                  const satisfaction = r.satisfactionRate;
                  const rewardAmount = rewardPart * (satisfaction / 100);
                  const totalFee = guestMeals + basicFee + rewardAmount;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="border border-slate-300 px-4 py-3 text-center font-medium">{r.periodName}</td>
                      <td className="border border-slate-300 px-4 py-3 text-right font-mono">{monthlyTotal.toFixed(2)}</td>
                      <td className="border border-slate-300 px-4 py-3 text-right font-mono">{guestMeals.toFixed(2)}</td>
                      <td className="border border-slate-300 px-4 py-3 text-right font-mono">{basicFee.toFixed(2)}</td>
                      <td className="border border-slate-300 px-4 py-3 text-right font-mono">{rewardPart.toFixed(2)}</td>
                      <td className="border border-slate-300 px-4 py-3 text-center text-blue-600 font-bold">{satisfaction.toFixed(2)}%</td>
                      <td className="border border-slate-300 px-4 py-3 text-right font-mono text-emerald-600 font-bold">{rewardAmount.toFixed(2)}</td>
                      <td className="border border-slate-300 px-4 py-3 text-right font-mono bg-slate-50 font-bold text-slate-900">{totalFee.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-slate-100 font-bold">
                  <td className="border border-slate-300 px-4 py-3 text-center">合计</td>
                  <td className="border border-slate-300 px-4 py-3 text-right font-mono">
                    {reports.reduce((sum, r) => sum + (r.annualContractTotal / 12), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-right font-mono">
                    {reports.reduce((sum, r) => sum + (r.guestMealsCount * r.guestMealsRate), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-right font-mono">
                    {reports.reduce((sum, r) => sum + (r.annualContractTotal / 12 * 0.85), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-right font-mono">
                    {reports.reduce((sum, r) => sum + (r.annualContractTotal / 12 * 0.15), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-center">-</td>
                  <td className="border border-slate-300 px-4 py-3 text-right font-mono text-emerald-600">
                    {reports.reduce((sum, r) => sum + (r.annualContractTotal / 12 * 0.15 * (r.satisfactionRate / 100)), 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-right font-mono bg-slate-200 text-slate-900">
                    {reports.reduce((sum, r) => {
                      const m = r.annualContractTotal / 12;
                      const g = r.guestMealsCount * r.guestMealsRate;
                      const b = m * 0.85;
                      const rp = m * 0.15;
                      const ra = rp * (r.satisfactionRate / 100);
                      return sum + (g + b + ra);
                    }, 0).toFixed(2)}
                  </td>
                </tr>
                {/* Placeholder rows to match image feel if few reports */}
                {reports.length < 5 && Array.from({ length: 5 - reports.length }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className="border border-slate-300 px-4 py-3 h-11 text-center text-slate-300 italic text-xs">... 待生成 ...</td>
                    <td className="border border-slate-300 px-4 py-3"></td>
                    <td className="border border-slate-300 px-4 py-3"></td>
                    <td className="border border-slate-300 px-4 py-3"></td>
                    <td className="border border-slate-300 px-4 py-3"></td>
                    <td className="border border-slate-300 px-4 py-3"></td>
                    <td className="border border-slate-300 px-4 py-3"></td>
                    <td className="border border-slate-300 px-4 py-3"></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-8 grid grid-cols-4 gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
              <div className="border-t border-slate-300 pt-2">分管领导</div>
              <div className="border-t border-slate-300 pt-2">办公室主任</div>
              <div className="border-t border-slate-300 pt-2">统计</div>
              <div className="border-t border-slate-300 pt-2">制表</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
