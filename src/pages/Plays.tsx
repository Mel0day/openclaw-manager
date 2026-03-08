const PLAYS = [
  {
    icon: '📕',
    title: '小红书自动运营',
    tag: '内容运营',
    tagColor: '#ff2442',
    desc: '通过 OpenClaw 结合小红书 API 或 RPA 工具，实现笔记自动发布、评论自动回复、私信引流等操作，降低运营人力成本。',
    scenarios: [
      { label: '自动发帖', detail: 'AI 根据选题模板生成图文内容，定时发布到小红书账号' },
      { label: '评论自动回复', detail: '监听新评论，AI 识别意图后自动回复，区分咨询、互动、负面情绪' },
      { label: '私信跟进', detail: '用户私信后 AI 自动引导到社群或留资，支持多轮对话' },
    ],
    tips: '建议配合小红书企业号或第三方 RPA 工具（如 BrowserUse、Playwright）实现自动化，避免违规风险。',
  },
  {
    icon: '💬',
    title: '微信群智能问答 Bot',
    tag: '私域运营',
    tagColor: '#07c160',
    desc: '在微信群里部署 AI Bot，自动识别并回答成员问题，支持知识库检索，让群不再需要专人值守。',
    scenarios: [
      { label: '@Bot 问答', detail: '成员 @ 机器人提问，AI 从知识库中检索答案后回复' },
      { label: '关键词触发', detail: '群内出现特定词（如"价格""怎么买"）时自动触发回复流程' },
      { label: '新成员欢迎', detail: '检测新成员入群，自动发送欢迎语和群规引导' },
    ],
    tips: '微信群 Bot 通常需要借助 Dify、WeChatFerry 或企业微信第三方应用实现接入，OpenClaw 负责 AI 对话逻辑部分。',
  },
  {
    icon: '🛒',
    title: '电商售前客服自动化',
    tag: '客服',
    tagColor: '#f5a623',
    desc: '将 OpenClaw 接入店铺客服渠道，自动处理商品咨询、物流查询、退换货说明等高频问题，24 小时不掉线。',
    scenarios: [
      { label: '商品问答', detail: 'AI 基于商品知识库自动回答规格、库存、使用方法等问题' },
      { label: '物流查询', detail: '调用物流 API 获取实时状态，由 AI 整合后回复用户' },
      { label: '超时转人工', detail: '识别复杂问题或负面情绪，自动转接人工并附上对话摘要' },
    ],
    tips: '可接入淘宝、抖店、京东等平台的客服 OpenAPI，也可通过 Webhook 与第三方客服系统（如 Zendesk）对接。',
  },
  {
    icon: '📊',
    title: '数据监控自动播报',
    tag: '自动化',
    tagColor: '#6366f1',
    desc: '定时拉取业务数据（GMV、DAU、转化率等），由 AI 生成分析摘要，自动推送到飞书 / 钉钉群，替代人工日报。',
    scenarios: [
      { label: '每日数据日报', detail: 'Cron 任务每天早 9 点拉取昨日数据，AI 生成图文播报' },
      { label: '异常告警', detail: '数据超出阈值时立即触发告警，AI 给出可能原因分析' },
      { label: '竞品动态播报', detail: '定时抓取竞品价格 / 活动，AI 汇总后推送给运营团队' },
    ],
    tips: '数据源可以是 MySQL、BigQuery、Google Sheets、或任意 REST API，通过 Function Calling 连接。',
  },
  {
    icon: '✍️',
    title: 'AI 内容创作流水线',
    tag: '内容生产',
    tagColor: '#0ea5e9',
    desc: '输入选题或关键词，AI 自动完成文案撰写、配图描述、SEO 优化，批量生产多平台内容。',
    scenarios: [
      { label: '批量生成文案', detail: '上传选题列表，AI 按品牌调性批量输出小红书 / 公众号文章' },
      { label: '多平台改写', detail: '同一内容自动适配小红书、微博、抖音等不同平台风格和字数要求' },
      { label: '评论素材库', detail: 'AI 预生成几十条差异化评论，运营直接选用，提升效率' },
    ],
    tips: '结合 Workspace 中的 Agent 人格配置，可以让不同账号输出各自的风格，避免内容雷同。',
  },
  {
    icon: '🎯',
    title: '私域用户分层运营',
    tag: '私域运营',
    tagColor: '#07c160',
    desc: '基于用户行为和标签，AI 自动触发个性化触达：新客欢迎、沉睡用户唤醒、高价值用户专属服务。',
    scenarios: [
      { label: '新用户引导', detail: '用户注册或入群后，AI 根据来源渠道推送不同的引导路径' },
      { label: '沉睡唤醒', detail: '30 天未互动的用户，AI 生成个性化唤醒文案定时发出' },
      { label: 'VIP 专属服务', detail: '识别高客单用户，转交专属顾问并提供优先响应' },
    ],
    tips: '需要 CRM 系统提供用户标签数据，通过 OpenClaw 的 Function Calling 接口实时读取和写入用户状态。',
  },
];

function ScenarioTag({ label, detail }: { label: string; detail: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.6 }}>
      <span style={{
        flexShrink: 0,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '1px 7px',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--muted2)',
        marginTop: 1,
      }}>{label}</span>
      <span style={{ color: 'var(--fg, #e2e8f0)' }}>{detail}</span>
    </div>
  );
}

function PlayCard({ play }: { play: typeof PLAYS[0] }) {
  return (
    <div style={{
      background: 'var(--card2)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{play.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{play.title}</span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: play.tagColor,
          border: `1px solid ${play.tagColor}`,
          borderRadius: 4,
          padding: '2px 6px',
          whiteSpace: 'nowrap',
        }}>{play.tag}</span>
      </div>

      {/* Desc */}
      <p style={{ fontSize: 12, color: 'var(--muted2)', margin: 0, lineHeight: 1.7 }}>
        {play.desc}
      </p>

      {/* Scenarios */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {play.scenarios.map((s, i) => (
          <ScenarioTag key={i} label={s.label} detail={s.detail} />
        ))}
      </div>

      {/* Tips */}
      <div style={{
        background: 'var(--bg)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: '0 4px 4px 0',
        padding: '6px 10px',
        fontSize: 11,
        color: 'var(--muted2)',
        lineHeight: 1.6,
      }}>
        💡 {play.tips}
      </div>
    </div>
  );
}

export default function Plays() {
  return (
    <>
      <div className="card">
        <div className="card-title">玩法推荐</div>
        <p style={{ fontSize: 12, color: 'var(--muted2)', margin: '0 0 4px' }}>
          以下是 OpenClaw 在实际业务中最常见的落地场景，每个场景都可以独立使用或组合运行。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {PLAYS.map((p, i) => <PlayCard key={i} play={p} />)}
      </div>
    </>
  );
}
