#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidMilestone = 4,
    MilestoneNotPending = 5,
    MilestoneNotSubmitted = 6,
    AutoReleaseWindowNotPassed = 7,
    EscrowAlreadyDisputed = 8,
    EscrowNotDisputed = 9,
    EscrowAlreadyCompleted = 10,
    InvalidConfiguration = 11,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum MilestoneStatus {
    Pending = 0,
    Submitted = 1,
    Approved = 2,
    Disputed = 3,
    AutoClaimed = 4,
    Refunded = 5,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct Milestone {
    pub id: u32,
    pub title: String,
    pub amount: i128,
    pub status: MilestoneStatus,
    pub submitted_at: u64,
    pub evidence_hash: String,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct EscrowState {
    pub buyer: Address,
    pub contractor: Address,
    pub arbiter: Address,
    pub auto_release_window: u64,
    pub total_amount: i128,
    pub released_amount: i128,
    pub current_milestone: u32,
    pub is_completed: bool,
    pub is_disputed: bool,
}

const STATE_KEY: Symbol = symbol_short!("STATE");
const MILESTONES_KEY: Symbol = symbol_short!("MILES");

#[contract]
pub struct StellarStreamEscrow;

#[contractimpl]
impl StellarStreamEscrow {
    /// Initialize the multi-milestone escrow vault
    pub fn initialize(
        env: Env,
        buyer: Address,
        contractor: Address,
        arbiter: Address,
        auto_release_window: u64,
        milestone_amounts: Vec<i128>,
        milestone_titles: Vec<String>,
    ) -> Result<(), EscrowError> {
        if env.storage().instance().has(&STATE_KEY) {
            return Err(EscrowError::AlreadyInitialized);
        }

        buyer.require_auth();

        let count = milestone_amounts.len();
        if count == 0 || count != milestone_titles.len() {
            return Err(EscrowError::InvalidConfiguration);
        }

        let mut total: i128 = 0;
        let mut milestones: Vec<Milestone> = Vec::new(&env);

        for i in 0..count {
            let amt = milestone_amounts.get(i).unwrap();
            let title = milestone_titles.get(i).unwrap();
            if amt <= 0 {
                return Err(EscrowError::InvalidConfiguration);
            }
            total = total.checked_add(amt).ok_or(EscrowError::InvalidConfiguration)?;

            milestones.push_back(Milestone {
                id: i,
                title,
                amount: amt,
                status: MilestoneStatus::Pending,
                submitted_at: 0,
                evidence_hash: String::from_str(&env, ""),
            });
        }

        let state = EscrowState {
            buyer,
            contractor,
            arbiter,
            auto_release_window,
            total_amount: total,
            released_amount: 0,
            current_milestone: 0,
            is_completed: false,
            is_disputed: false,
        };

        env.storage().instance().set(&STATE_KEY, &state);
        env.storage().instance().set(&MILESTONES_KEY, &milestones);

        Ok(())
    }

    /// Contractor submits deliverables for the active milestone
    pub fn submit_milestone(
        env: Env,
        contractor: Address,
        milestone_id: u32,
        evidence_hash: String,
    ) -> Result<(), EscrowError> {
        let state: EscrowState = env.storage().instance().get(&STATE_KEY).ok_or(EscrowError::NotInitialized)?;
        if state.is_completed {
            return Err(EscrowError::EscrowAlreadyCompleted);
        }
        if state.is_disputed {
            return Err(EscrowError::EscrowAlreadyDisputed);
        }

        if contractor != state.contractor {
            return Err(EscrowError::Unauthorized);
        }
        contractor.require_auth();

        if milestone_id != state.current_milestone {
            return Err(EscrowError::InvalidMilestone);
        }

        let mut milestones: Vec<Milestone> = env.storage().instance().get(&MILESTONES_KEY).unwrap();
        let mut m = milestones.get(milestone_id).ok_or(EscrowError::InvalidMilestone)?;

        if m.status != MilestoneStatus::Pending {
            return Err(EscrowError::MilestoneNotPending);
        }

        let now = env.ledger().timestamp();
        m.status = MilestoneStatus::Submitted;
        m.submitted_at = now;
        m.evidence_hash = evidence_hash;

        milestones.set(milestone_id, m);
        env.storage().instance().set(&MILESTONES_KEY, &milestones);

        Ok(())
    }

    /// Buyer approves milestone and unlocks payment
    pub fn approve_milestone(
        env: Env,
        buyer: Address,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        let mut state: EscrowState = env.storage().instance().get(&STATE_KEY).ok_or(EscrowError::NotInitialized)?;
        if state.is_completed {
            return Err(EscrowError::EscrowAlreadyCompleted);
        }
        if state.is_disputed {
            return Err(EscrowError::EscrowAlreadyDisputed);
        }

        if buyer != state.buyer {
            return Err(EscrowError::Unauthorized);
        }
        buyer.require_auth();

        if milestone_id != state.current_milestone {
            return Err(EscrowError::InvalidMilestone);
        }

        let mut milestones: Vec<Milestone> = env.storage().instance().get(&MILESTONES_KEY).unwrap();
        let mut m = milestones.get(milestone_id).ok_or(EscrowError::InvalidMilestone)?;

        if m.status != MilestoneStatus::Submitted && m.status != MilestoneStatus::Pending {
            return Err(EscrowError::MilestoneNotSubmitted);
        }

        m.status = MilestoneStatus::Approved;
        milestones.set(milestone_id, m.clone());

        state.released_amount += m.amount;
        state.current_milestone += 1;
        if state.current_milestone >= milestones.len() {
            state.is_completed = true;
        }

        env.storage().instance().set(&STATE_KEY, &state);
        env.storage().instance().set(&MILESTONES_KEY, &milestones);

        Ok(())
    }

    /// Anti-ghosting: If buyer doesn't respond before auto_release_window ends, contractor auto-claims payout
    pub fn auto_claim_milestone(
        env: Env,
        contractor: Address,
        milestone_id: u32,
    ) -> Result<(), EscrowError> {
        let mut state: EscrowState = env.storage().instance().get(&STATE_KEY).ok_or(EscrowError::NotInitialized)?;
        if state.is_completed {
            return Err(EscrowError::EscrowAlreadyCompleted);
        }
        if state.is_disputed {
            return Err(EscrowError::EscrowAlreadyDisputed);
        }

        if contractor != state.contractor {
            return Err(EscrowError::Unauthorized);
        }
        contractor.require_auth();

        if milestone_id != state.current_milestone {
            return Err(EscrowError::InvalidMilestone);
        }

        let mut milestones: Vec<Milestone> = env.storage().instance().get(&MILESTONES_KEY).unwrap();
        let mut m = milestones.get(milestone_id).ok_or(EscrowError::InvalidMilestone)?;

        if m.status != MilestoneStatus::Submitted {
            return Err(EscrowError::MilestoneNotSubmitted);
        }

        let now = env.ledger().timestamp();
        if now < m.submitted_at + state.auto_release_window {
            return Err(EscrowError::AutoReleaseWindowNotPassed);
        }

        m.status = MilestoneStatus::AutoClaimed;
        milestones.set(milestone_id, m.clone());

        state.released_amount += m.amount;
        state.current_milestone += 1;
        if state.current_milestone >= milestones.len() {
            state.is_completed = true;
        }

        env.storage().instance().set(&STATE_KEY, &state);
        env.storage().instance().set(&MILESTONES_KEY, &milestones);

        Ok(())
    }

    /// Either party can raise a dispute on the active milestone
    pub fn raise_dispute(
        env: Env,
        sender: Address,
        milestone_id: u32,
        _reason: String,
    ) -> Result<(), EscrowError> {
        let mut state: EscrowState = env.storage().instance().get(&STATE_KEY).ok_or(EscrowError::NotInitialized)?;
        if state.is_completed {
            return Err(EscrowError::EscrowAlreadyCompleted);
        }
        if state.is_disputed {
            return Err(EscrowError::EscrowAlreadyDisputed);
        }

        if sender != state.buyer && sender != state.contractor {
            return Err(EscrowError::Unauthorized);
        }
        sender.require_auth();

        if milestone_id != state.current_milestone {
            return Err(EscrowError::InvalidMilestone);
        }

        let mut milestones: Vec<Milestone> = env.storage().instance().get(&MILESTONES_KEY).unwrap();
        let mut m = milestones.get(milestone_id).ok_or(EscrowError::InvalidMilestone)?;

        m.status = MilestoneStatus::Disputed;
        milestones.set(milestone_id, m);

        state.is_disputed = true;

        env.storage().instance().set(&STATE_KEY, &state);
        env.storage().instance().set(&MILESTONES_KEY, &milestones);

        Ok(())
    }

    /// Arbiter resolves dispute: either pays contractor or refunds buyer
    pub fn resolve_dispute(
        env: Env,
        arbiter: Address,
        milestone_id: u32,
        release_to_contractor: bool,
    ) -> Result<(), EscrowError> {
        let mut state: EscrowState = env.storage().instance().get(&STATE_KEY).ok_or(EscrowError::NotInitialized)?;
        if !state.is_disputed {
            return Err(EscrowError::EscrowNotDisputed);
        }

        if arbiter != state.arbiter {
            return Err(EscrowError::Unauthorized);
        }
        arbiter.require_auth();

        let mut milestones: Vec<Milestone> = env.storage().instance().get(&MILESTONES_KEY).unwrap();
        let mut m = milestones.get(milestone_id).ok_or(EscrowError::InvalidMilestone)?;

        if release_to_contractor {
            m.status = MilestoneStatus::Approved;
            state.released_amount += m.amount;
        } else {
            m.status = MilestoneStatus::Refunded;
        }

        milestones.set(milestone_id, m);

        state.is_disputed = false;
        state.current_milestone += 1;
        if state.current_milestone >= milestones.len() {
            state.is_completed = true;
        }

        env.storage().instance().set(&STATE_KEY, &state);
        env.storage().instance().set(&MILESTONES_KEY, &milestones);

        Ok(())
    }

    /// Get current state of the escrow
    pub fn get_state(env: Env) -> Result<EscrowState, EscrowError> {
        env.storage().instance().get(&STATE_KEY).ok_or(EscrowError::NotInitialized)
    }

    /// Get all milestones
    pub fn get_milestones(env: Env) -> Result<Vec<Milestone>, EscrowError> {
        env.storage().instance().get(&MILESTONES_KEY).ok_or(EscrowError::NotInitialized)
    }
}

#[cfg(test)]
mod test;
