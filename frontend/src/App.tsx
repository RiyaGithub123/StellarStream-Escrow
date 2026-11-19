import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  FileCheck, 
  Coins, 
  ExternalLink, 
  RefreshCw,
  PlusCircle,
  Copy,
  UserCheck
} from 'lucide-react';

interface Milestone {
  id: number;
  title: string;
  amount: number;
  status: 'Pending' | 'Submitted' | 'Approved' | 'Disputed' | 'AutoClaimed' | 'Refunded';
  submittedAt?: string;
  evidenceHash?: string;
}

export default function App() {
  const [activeRole, setActiveRole] = useState<'buyer' | 'contractor' | 'arbiter'>('buyer');
  const [network, setNetwork] = useState<'testnet' | 'simulated'>('testnet');
  const [copied, setCopied] = useState<string | null>(null);

  // Escrow Configuration State
  const [buyer] = useState('GBUYER...4X8K');
  const [contractor] = useState('GDEV...9Q2M');
  const [arbiter] = useState('GARBITER...7L1P');
  const [autoReleaseWindowHours] = useState(24);
  const [isDisputed, setIsDisputed] = useState(false);

  const [milestones, setMilestones] = useState<Milestone[]>([
    {
      id: 0,
      title: 'Milestone 1: Smart Contract Architecture & Soroban Specification',
      amount: 1500,
      status: 'Approved',
      submittedAt: '2026-11-20 18:30 UTC',
      evidenceHash: 'ipfs://bafybeih4j3k2...arch_spec.pdf'
    },
    {
      id: 1,
      title: 'Milestone 2: Multi-Sig Social Recovery & Unit Test Suite',
      amount: 2500,
      status: 'Submitted',
      submittedAt: '2026-11-20 21:15 UTC',
      evidenceHash: 'ipfs://bafybeic9x8m1...soroban_wasm_build.tar'
    },
    {
      id: 2,
      title: 'Milestone 3: Security Audit, Testnet Deployment & Frontend Portal',
      amount: 2000,
      status: 'Pending'
    }
  ]);

  const [evidenceInput, setEvidenceInput] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [activityLogs, setActivityLogs] = useState<string[]>([
    'Ledger #482019: Escrow Vault initialized with 6,000 XLM across 3 milestones',
    'Ledger #482084: Milestone 1 deliverables submitted by Contractor',
    'Ledger #482150: Milestone 1 approved by Buyer. 1,500 XLM transferred to Contractor',
    'Ledger #482310: Milestone 2 deliverables submitted. Anti-ghosting timer running (24h).'
  ]);

  const totalAmount = milestones.reduce((acc, m) => acc + m.amount, 0);
  const releasedAmount = milestones
    .filter(m => m.status === 'Approved' || m.status === 'AutoClaimed')
    .reduce((acc, m) => acc + m.amount, 0);
  const progressPercent = Math.round((releasedAmount / totalAmount) * 100);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setActivityLogs(prev => [`[${timestamp}] ${msg}`, ...prev]);
  };

  const handleApprove = (id: number) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, status: 'Approved' } : m));
    addLog(`Buyer approved Milestone #${id + 1}. Funds released on-chain.`);
  };

  const handleSubmitMilestone = (id: number) => {
    if (!evidenceInput) return;
    setMilestones(prev => prev.map(m => m.id === id ? {
      ...m,
      status: 'Submitted',
      submittedAt: new Date().toISOString(),
      evidenceHash: evidenceInput
    } : m));
    addLog(`Contractor submitted deliverables for Milestone #${id + 1} with proof: ${evidenceInput.slice(0, 20)}...`);
    setEvidenceInput('');
    setShowSubmitModal(false);
  };

  const handleAutoClaim = (id: number) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, status: 'AutoClaimed' } : m));
    addLog(`ANTI-GHOSTING ACTIVATED: 24h passed with no buyer dispute. Milestone #${id + 1} auto-claimed by Contractor!`);
  };

  const handleDispute = (id: number) => {
    setIsDisputed(true);
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, status: 'Disputed' } : m));
    addLog(`ALERT: Milestone #${id + 1} flagged as DISPUTED. Arbiter intervention required.`);
  };

  const handleResolveDispute = (id: number, releaseToContractor: boolean) => {
    setIsDisputed(false);
    setMilestones(prev => prev.map(m => m.id === id ? {
      ...m,
      status: releaseToContractor ? 'Approved' : 'Refunded'
    } : m));
    addLog(`ARBITER RESOLUTION: Dispute for Milestone #${id + 1} resolved. Outcome: ${releaseToContractor ? 'Released to Contractor' : 'Refunded to Buyer'}.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Top Navigation */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between border-b border-slate-800 pb-5 mb-8 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-300 to-teal-300 bg-clip-text text-transparent">
              StellarStream Escrow
            </h1>
            <p className="text-xs text-slate-400">Autonomous Milestone Smart Vault with Anti-Ghosting Timelocks</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <span className="px-2 text-slate-400">Simulate Role:</span>
            {(['buyer', 'contractor', 'arbiter'] as const).map(role => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`px-3 py-1 rounded-md capitalize font-medium transition ${
                  activeRole === role ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setNetwork(prev => prev === 'testnet' ? 'simulated' : 'testnet')}
            className="flex items-center space-x-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Stellar {network.toUpperCase()}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Escrow Overview & Financial Metrics */}
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Escrow Contract #ST-8821</span>
                <h2 className="text-xl font-bold mt-1 text-white">Full-Stack Protocol Upgrade</h2>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                isDisputed ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isDisputed ? 'Dispute Active' : 'Normal Operation'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 my-6">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Total Locked</span>
                <p className="text-2xl font-bold text-white mt-1">{totalAmount.toLocaleString()} <span className="text-xs font-normal text-indigo-400">XLM</span></p>
              </div>
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Total Released</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{releasedAmount.toLocaleString()} <span className="text-xs font-normal text-slate-400">XLM</span></p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Vault Progress</span>
                <span className="font-semibold text-white">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-sky-400 h-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Smart Contract Participants */}
            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Vault Participants</span>
              {[
                { role: 'Buyer', address: buyer, tag: 'Depositor' },
                { role: 'Contractor', address: contractor, tag: 'Builder' },
                { role: 'Arbiter', address: arbiter, tag: 'Mediator' },
              ].map(p => (
                <div key={p.role} className="flex items-center justify-between text-xs bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="flex items-center space-x-2">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-medium text-slate-300">{p.role}:</span>
                    <span className="font-mono text-slate-400">{p.address}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(p.address, p.role)}
                    className="text-slate-500 hover:text-slate-200"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Anti-Ghosting Feature Highlight */}
            <div className="mt-6 p-3.5 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center space-x-2 text-indigo-300 font-semibold">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>Anti-Ghosting Safeguard: {autoReleaseWindowHours} Hours</span>
              </div>
              <p className="text-slate-400">
                If the buyer remains silent without dispute after milestone submission, the smart contract allows the contractor to trigger autonomous payout.
              </p>
            </div>
          </div>

          {/* Activity / Ledger Terminal */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">On-Chain Activity</span>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live RPC
              </span>
            </div>
            <div className="bg-slate-950 font-mono text-[11px] text-slate-300 p-3 rounded-xl border border-slate-800/70 space-y-1.5 max-h-48 overflow-y-auto">
              {activityLogs.map((log, i) => (
                <div key={i} className="leading-relaxed border-l-2 border-indigo-500/50 pl-2">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (2 cols): Milestones Lifecycle Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-800 gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Escrow Milestone Pipeline</h3>
                <p className="text-xs text-slate-400 mt-0.5">Cryptographic verification, proofs of delivery, and condition checks</p>
              </div>
              <div className="text-xs px-3 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg">
                Active Actor: <span className="font-bold uppercase tracking-wider">{activeRole}</span>
              </div>
            </div>

            <div className="space-y-4 mt-6">
              {milestones.map((milestone, idx) => {
                const isCurrent = (idx === 0 && milestone.status !== 'Approved') || 
                                 (idx > 0 && milestones[idx - 1].status === 'Approved' && milestone.status !== 'Approved');

                return (
                  <div 
                    key={milestone.id}
                    className={`p-5 rounded-xl border transition-all ${
                      milestone.status === 'Approved' 
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-80' 
                        : milestone.status === 'Disputed'
                        ? 'bg-amber-950/20 border-amber-800/50'
                        : isCurrent
                        ? 'bg-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-950/30'
                        : 'bg-slate-950/60 border-slate-800/80'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start space-x-3">
                        <div className={`mt-0.5 p-2 rounded-lg ${
                          milestone.status === 'Approved' || milestone.status === 'AutoClaimed'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : milestone.status === 'Disputed'
                            ? 'bg-amber-500/20 text-amber-400'
                            : milestone.status === 'Submitted'
                            ? 'bg-sky-500/20 text-sky-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {milestone.status === 'Approved' || milestone.status === 'AutoClaimed' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : milestone.status === 'Disputed' ? (
                            <AlertTriangle className="w-5 h-5" />
                          ) : (
                            <FileCheck className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-white text-sm sm:text-base">{milestone.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                            <span className="flex items-center text-indigo-300 font-semibold">
                              <Coins className="w-3.5 h-3.5 mr-1" />
                              {milestone.amount} XLM
                            </span>
                            {milestone.submittedAt && (
                              <span className="text-slate-500">Submitted: {milestone.submittedAt}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          milestone.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-300' :
                          milestone.status === 'AutoClaimed' ? 'bg-teal-500/20 text-teal-300' :
                          milestone.status === 'Disputed' ? 'bg-amber-500/20 text-amber-300' :
                          milestone.status === 'Submitted' ? 'bg-sky-500/20 text-sky-300' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {milestone.status}
                        </span>
                      </div>
                    </div>

                    {/* Deliverable Evidence */}
                    {milestone.evidenceHash && (
                      <div className="mt-3 text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
                        <span className="font-mono text-slate-400 truncate max-w-xs sm:max-w-md">
                          Proof: <span className="text-indigo-300">{milestone.evidenceHash}</span>
                        </span>
                        <a href="#" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                          Verify <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Interactive Action Triggers based on State & Role */}
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-end gap-2">
                      {/* Contractor Actions */}
                      {activeRole === 'contractor' && milestone.status === 'Pending' && isCurrent && (
                        <button
                          onClick={() => setShowSubmitModal(true)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                        >
                          Submit Milestone Deliverables
                        </button>
                      )}

                      {activeRole === 'contractor' && milestone.status === 'Submitted' && (
                        <button
                          onClick={() => handleAutoClaim(milestone.id)}
                          className="bg-teal-600/80 hover:bg-teal-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5"
                          title="Auto claim if buyer didn't dispute in time"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Execute Anti-Ghosting Auto-Claim
                        </button>
                      )}

                      {/* Buyer Actions */}
                      {activeRole === 'buyer' && milestone.status === 'Submitted' && (
                        <>
                          <button
                            onClick={() => handleDispute(milestone.id)}
                            className="bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-600/40 text-xs font-semibold px-3 py-2 rounded-lg transition flex items-center gap-1.5"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Raise Dispute
                          </button>
                          <button
                            onClick={() => handleApprove(milestone.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve & Release {milestone.amount} XLM
                          </button>
                        </>
                      )}

                      {/* Arbiter Actions */}
                      {activeRole === 'arbiter' && milestone.status === 'Disputed' && (
                        <>
                          <button
                            onClick={() => handleResolveDispute(milestone.id, false)}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                          >
                            Resolve: Refund Buyer
                          </button>
                          <button
                            onClick={() => handleResolveDispute(milestone.id, true)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                          >
                            Resolve: Pay Contractor
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Submission Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Submit Milestone Deliverables</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the cryptographic proof, IPFS CID, or GitHub commit hash of the delivered work.
            </p>
            <input 
              type="text"
              placeholder="e.g. ipfs://bafybeic7..."
              value={evidenceInput}
              onChange={(e) => setEvidenceInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 mb-4 font-mono"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleSubmitMilestone(2)}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
              >
                Sign & Submit on Soroban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
