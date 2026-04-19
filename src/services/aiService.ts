import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, RecipeCategory } from "../types";

// Providers Configuration
const AI_CONFIG = {
  preferDomestic: import.meta.env.VITE_AI_MODE === 'china'
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const aiService = {
  /**
   * 自动生成或优化菜谱建议
   */
  async suggestRecipes(prompt: string, category?: RecipeCategory): Promise<Partial<Recipe>[]> {
    const systemPrompt = `你是一位专业的职工食堂厨师长和营养师。请根据用户的需求推荐菜谱。
你需要返回一个包含菜名、分类、预估单人成本（元）、打分推荐度（rating，0-5）、营养标签（如：高蛋白、高纤维等）、主要配料和简短说明的列表。
成本预估应符合中国大众食堂的水平。所有金额/单价数值必须四舍五入保留小数点后一位。返回格式必须是 JSON 数组。`;

    // Try Domestic first if preferred
    if (AI_CONFIG.preferDomestic) {
      try {
        const response = await fetch('/api/ai/domestic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (response.ok) {
          const completion = await response.json();
          const content = completion.choices[0].message.content;
          if (content) {
            try {
              const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              const parsed = JSON.parse(cleanedContent);
              return Array.isArray(parsed) ? parsed : (parsed.recipes || parsed.data || []);
            } catch (parseError) {
              console.error("Failed to parse JSON response:", content);
              return [];
            }
          }
        }
      } catch (e) {
        console.error("Domestic AI failed, falling back to Gemini:", e);
      }
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category: { 
                  type: Type.STRING, 
                  enum: ['staple', 'meat', 'vegetable', 'soup', 'other'] 
                },
                estimatedCost: { type: Type.NUMBER },
                rating: { type: Type.NUMBER },
                nutritionTags: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING } 
                },
                ingredients: { 
                  type: Type.ARRAY, 
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      amount: { type: Type.STRING }
                    },
                    required: ["name"]
                  }
                },
                description: { type: Type.STRING }
              },
              required: ["name", "category", "estimatedCost", "ingredients"]
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (e) {
      console.error("Gemini AI failed:", e);
      return [];
    }
  },

  /**
   * 优化周谱搭配
   */
  async optimizeWeeklyMenu(weeklyMenuData: any, recipes: Recipe[], budgetLimit: number): Promise<string> {
    const prompt = `
当前周谱数据: ${JSON.stringify(weeklyMenuData)}
现有可选菜谱库: ${JSON.stringify(recipes.map(r => ({ id: r.id, name: r.name, cost: r.estimatedCost, rating: r.rating || 0, tags: r.nutritionTags })))}
每日单人预算上限: ¥${budgetLimit}

请分析当前周谱的营养均衡性（蛋白质、维生素、纤维、碳水等搭配）和预算执行情况。
给出一份专业的优化建议报告（200字以内），指出哪些天搭配不够均衡，或者哪些天超支了，并给出改进方向。特别注意需要综合考量菜品的【口味反馈分数(rating)】与【预估成本】等维度进行总体评判。建议在不超支（控制成本）的前提下，优先使用或替换成客人反馈分较高的菜品，寻找口味与成本的最佳平衡点。
使用中文回答。
`;

    const systemInstruction = "你是一位精通成本控制的食堂营养专家。请提供精准、专业的建议。";

    // Domestic Fallback
    if (AI_CONFIG.preferDomestic) {
      try {
        const response = await fetch('/api/ai/domestic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt }
            ]
          })
        });

        if (response.ok) {
          const completion = await response.json();
          return completion.choices[0].message.content || "无法生成建议。";
        }
      } catch (e) {
        console.error("Domestic AI Audit failed:", e);
      }
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
        }
      });
      return response.text || "未获获取有效分析建议。";
    } catch (e) {
      console.error("Gemini AI Audit failed:", e);
      return "未配置 AI 服务，请检查 API 密钥。";
    }
  },

  /**
   * 按严格约束逻辑智能生成全周新菜单
   */
  async generateWeeklyMenu(recipes: Recipe[], budgetLimit: number): Promise<any> {
    const systemInstruction = `你是一个高级的企业食堂智能排菜系统。你的任务是根据给定的【可选菜谱库】和【单人单日预算】，排出一周（共7天，days[0]代表周一，days[6]代表周日）的三餐菜单。
返回格式必须是一个 JSON 对象，包含 days 数组（长度为7的数组）。
每个元素的结构应为：{ breakfast: { recipeIds: [...] }, lunch: { recipeIds: [...] }, dinner: { recipeIds: [...] } }

你必须极其严格地遵守这些排菜规则：
1. 【口味与文化】遵循北方人口味。必须兼顾女同事（低脂、高纤、多蔬菜）和伊斯兰信仰（必须有合规的清真菜选项）。
2. 【营养与重复度】每天菜谱不同，本周内的菜式要尽量保持多样化不重样。在可控成本内，优先挑选口味打分（rating）较高的菜品。
3. 【每日餐食结构】必须极其苛刻地符合以下模型：
   - 早餐：1 样稀饭（粥类） + 1 样牛奶或豆浆 + 鸡蛋 + 牛肉面 + 2 样小菜
   - 午餐：2 样纯素菜 + 1 样半荤半素 + 1 样纯肉大荤 + 1 样汤 + 1 样水果（严格保证四菜一汤配置）
   - 晚餐常规配置（周一、周三、周六、周日）：以面食为主搭配主食 + 粗粮 + 2 样小菜
4. 【特殊时间强制规则】：
   - 粥类（稀饭）绝对只能在早餐出现，午餐和晚餐绝不能包含粥类！
   - 第2天(周二)、第4天(周四)、第5天(周五)的晚餐（下午）：必须固定为【牛肉面 + 牛奶 + 鸡蛋 + 2 样小菜】的特殊配置。
5. 【精度约束】所有返回的金额、成本、预算数值均需四舍五入保留小数点后一位。
6. 【专属餐段及类别联动约束】菜品的类别(category)可能标记为多个，如果菜谱自带 \`mealTime\` 属性（如包含 'breakfast' / 'lunch' / 'dinner'），它意味着这个菜最适合在这些餐段出现！如果一个菜的 \`mealTime\` 包含多个餐段（例如同时适合午餐和晚餐），你可以根据预算自由挑选安排到其中一个或多个匹配的餐段。绝对不要把明确只属于其它餐段的菜塞进错误的餐段里。
7. 【预算约束】每天（三餐之和）所有被选菜品的 estimatedCost 累计，绝不能超过单人预算 ¥${budgetLimit} !
8. 【匹配约束】你必须只使用传入菜谱库中真实存在的菜品 ID！如果实在无法凑齐完美的餐食结构，请按照【不超过预算、优先清真/素菜】降级处理。绝不能伪造不存在的菜品 ID。`;

    const inventoryJSON = JSON.stringify(recipes.map(r => ({
      id: r.id, 
      name: r.name, 
      cat: r.category, 
      cost: r.estimatedCost, 
      rating: r.rating || 0,
      mealTime: r.mealTime || [],
      tags: r.nutritionTags.join(',')
    })));

    const prompt = `
=== 可选菜谱库 ===
${inventoryJSON}

=== 规则简述 ===
预算：¥${budgetLimit}/天
请按照系统指令的严酷排菜要求，结合北方口味、包含清真兼容，排除满7天菜单。

直接输出 JSON 对象： {"days": [...]}
`;

    // Try Domestic AI configuration first
    if (AI_CONFIG.preferDomestic) {
      try {
        const response = await fetch('/api/ai/domestic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (response.ok) {
          const completion = await response.json();
          let content = completion.choices[0].message.content;
          if (content) {
            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(content);
          }
        }
      } catch (e) {
        console.error("Domestic AI Menu Generation failed:", e);
      }
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json"
        }
      });
      
      let content = response.text || "{}";
      if (content) {
          content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          return JSON.parse(content);
      }
    } catch (e) {
      console.error("Gemini AI Menu Generation failed:", e);
    }

    throw new Error("模型调用失败或未找到可用模型");
  }
};
