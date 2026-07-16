"use client";

import styles from '@/app/dashboard/pipeline/pipeline.module.css';
import { useMemo, useEffect, useRef } from 'react';
import { Search, Brain, FileText, CheckCircle, Mail } from 'lucide-react';

const AGENT_NODES = [
  { id: 'intake', label: 'Requirements Extractor', icon: <Search size={24} /> },
  { id: 'strategist', label: 'Job Fit Strategist', icon: <Brain size={24} /> },
  { id: 'tailor', label: 'Resume Tailor', icon: <FileText size={24} /> },
  { id: 'reviewer', label: 'Quality Reviewer', icon: <CheckCircle size={24} /> },
  { id: 'cover_letter', label: 'Cover Letter Writer', icon: <Mail size={24} /> }
];

export default function AgentWorkflow({ logs, activePipelinePhase }: { logs: string[], activePipelinePhase?: 'intake' | 'tailor' }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine the active agent based on the latest log message
  const activeAgentInfo = useMemo(() => {
    if (!logs || logs.length === 0) {
      if (activePipelinePhase === 'tailor') return { id: 'tailor', message: 'Initializing Resume Tailor...' };
      return { id: 'intake', message: 'Initializing Requirements Extractor...' };
    }
    
    // Look at logs in reverse to find the latest active agent
    for (let i = logs.length - 1; i >= 0; i--) {
      const msg = logs[i].toLowerCase();
      if (msg.includes('extracting requirements')) return { id: 'intake', message: logs[i] };
      if (msg.includes('strategist')) return { id: 'strategist', message: logs[i] };
      if (msg.includes('tailoring cv')) return { id: 'tailor', message: logs[i] };
      if (msg.includes('reviewer')) return { id: 'reviewer', message: logs[i] };
      if (msg.includes('generating cover letter')) return { id: 'cover_letter', message: logs[i] };
    }
    
    // Fallback based on phase
    if (activePipelinePhase === 'tailor') {
      return { id: 'tailor', message: logs[logs.length - 1] };
    }
    
    return { id: 'intake', message: logs[logs.length - 1] }; // Fallback
  }, [logs, activePipelinePhase]);

  // Scroll to active node
  useEffect(() => {
    if (!containerRef.current || !activeAgentInfo.id) return;
    const activeNode = containerRef.current.querySelector(`[data-agent-id="${activeAgentInfo.id}"]`);
    if (activeNode) {
      activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeAgentInfo.id]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className={styles.workflowContainer} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      
      <div className={styles.workflowGraphWrapper}>
        <div className={styles.workflowGraph} ref={containerRef}>
          {AGENT_NODES.map((node, idx) => {
            const isActive = node.id === activeAgentInfo.id;
            // Determine if node is complete by checking if the active node is further along
            const nodeIndex = AGENT_NODES.findIndex(n => n.id === node.id);
            const activeIndex = AGENT_NODES.findIndex(n => n.id === activeAgentInfo.id);
            const isComplete = activeIndex > nodeIndex;

            return (
              <div key={node.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div 
                  data-agent-id={node.id}
                  className={`${styles.agentNode} ${isActive ? styles.agentNodeActive : ''} ${isComplete ? styles.agentNodeComplete : ''}`}
                >
                  <div className={styles.agentIcon}>{node.icon}</div>
                  <div className={styles.agentInfo}>
                    <div className={styles.agentLabel}>{node.label}</div>
                    {isActive && (
                      <div className={styles.agentStatus}>
                        <span className={styles.pulsingDot}></span>
                        Working...
                      </div>
                    )}
                    {isComplete && (
                      <div className={styles.agentStatusComplete}>
                        ✓ Complete
                      </div>
                    )}
                    {!isActive && !isComplete && (
                      <div className={styles.agentStatusPending}>
                        Pending
                      </div>
                    )}
                  </div>
                </div>

                {/* Edge/Connector between nodes */}
                {idx < AGENT_NODES.length - 1 && (
                  <div className={`${styles.agentConnector} ${isComplete ? styles.agentConnectorActive : ''}`}>
                    <div className={styles.connectorLine}></div>
                    <div className={styles.connectorArrow}>&rsaquo;</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.workflowLogViewer} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '120px' }}>
        <div className={styles.logLabel}>SYSTEM LOGS</div>
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative', WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 90%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 0%, black 90%, transparent 100%)', scrollbarWidth: 'none' }}>
          <style dangerouslySetInnerHTML={{__html: `
            .${styles.workflowLogViewer} *::-webkit-scrollbar { display: none; }
          `}} />
          <div style={{ padding: '8px 0 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logs.map((log, idx) => (
              <div key={idx} className={`${styles.logMessage} ${styles.animateFadeIn}`} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--accent-1)', marginRight: '8px' }}>{'> '}</span>
                <span style={{ color: 'var(--text-primary)' }}>{log}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

    </div>
  );
}
