import React, { forwardRef } from 'react';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export const Panel = forwardRef(function Panel(
  { as: Tag = 'div', className, pad = 'md', scroll, fill, variant, children, ...rest },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={cx(
        'panel',
        pad === 'sm' && 'panel--pad-sm',
        pad === 'md' && 'panel--pad',
        pad === false && null,
        scroll && 'panel--scroll',
        fill && 'panel--fill',
        variant === 'hitl' && 'panel--hitl',
        variant === 'verdict' && 'panel--verdict',
        variant === 'elevated' && 'panel--elevated',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export function Button({ variant = 'primary', block, icon, className, children, ...rest }) {
  return (
    <button
      className={cx(
        'btn',
        variant === 'primary' && 'btn--primary',
        variant === 'brand' && 'btn--brand',
        variant === 'ghost' && 'btn--ghost',
        variant === 'subtle' && 'btn--subtle',
        variant === 'success' && 'btn--success',
        block && 'btn--block',
        icon && 'btn--icon',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', className, children, ...rest }) {
  const toneClass =
    {
      neutral: '',
      active: 'badge-active',
      debater: 'badge-debater',
      challenger: 'badge-challenger',
      fact_checker: 'badge-fact-checker',
      judge: 'badge-judge',
      human: 'badge-human',
      summarizer: 'badge-summarizer'
    }[tone] || '';

  return (
    <span className={cx('badge', toneClass, className)} {...rest}>
      {children}
    </span>
  );
}

export function Field({ label, children, className }) {
  return (
    <div className={cx('field', className)}>
      {label ? <label className="field-label">{label}</label> : null}
      {children}
    </div>
  );
}

export function SectionTitle({ muted, children, className }) {
  return <h3 className={cx(muted ? 'section-title--muted' : 'section-title', className)}>{children}</h3>;
}

export function EmptyState({ icon, title, body, className }) {
  return (
    <div className={cx('empty-state', className)}>
      {icon ? <div className="empty-state__icon">{icon}</div> : null}
      {title ? <div className="empty-state__title">{title}</div> : null}
      {body ? <p className="empty-state__body">{body}</p> : null}
    </div>
  );
}

export function MetricCard({ icon, label, value, className }) {
  return (
    <div className={cx('metric-card', className)}>
      {icon ? <div className="metric-icon">{icon}</div> : null}
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
      </div>
    </div>
  );
}

export function ListItem({ active, className, children, ...rest }) {
  return (
    <div className={cx('list-item', active && 'list-item--active', className)} {...rest}>
      {children}
    </div>
  );
}

export function AgentNode({ role, label, active, state, children }) {
  return (
    <div className={cx('agent-node', `agent-node--${role}`, active && 'is-active')}>
      <div className={cx('agent-node__avatar', active && state === 'thinking' && 'animate-pulse')}>{children}</div>
      <span className="agent-node__name">{label}</span>
      {active && state ? (
        <span className="agent-node__state" style={{ color: `var(--agent-${role === 'fact_checker' ? 'fact-checker' : role})` }}>
          {state}
        </span>
      ) : null}
    </div>
  );
}
