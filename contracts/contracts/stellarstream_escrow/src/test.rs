#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, vec, Env, String};

#[test]
fn test_milestone_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarStreamEscrow, ());
    let client = StellarStreamEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let contractor = Address::generate(&env);
    let arbiter = Address::generate(&env);

    let amounts = vec![&env, 100_0000000i128, 200_0000000i128];
    let titles = vec![
        &env,
        String::from_str(&env, "Architecture Design"),
        String::from_str(&env, "MVP Implementation"),
    ];

    client.initialize(&buyer, &contractor, &arbiter, &86400, &amounts, &titles);

    let state = client.get_state();
    assert_eq!(state.total_amount, 300_0000000i128);
    assert_eq!(state.released_amount, 0);
    assert_eq!(state.current_milestone, 0);
    assert_eq!(state.is_completed, false);

    // Milestone 0: Submit & Approve
    let proof = String::from_str(&env, "ipfs://bafybeifaq7j4h5w...");
    client.submit_milestone(&contractor, &0, &proof);
    client.approve_milestone(&buyer, &0);

    let updated_state = client.get_state();
    assert_eq!(updated_state.released_amount, 100_0000000i128);
    assert_eq!(updated_state.current_milestone, 1);
    assert_eq!(updated_state.is_completed, false);

    // Milestone 1: Submit & Approve -> Completes
    let proof2 = String::from_str(&env, "ipfs://bafybeih6y2k...");
    client.submit_milestone(&contractor, &1, &proof2);
    client.approve_milestone(&buyer, &1);

    let final_state = client.get_state();
    assert_eq!(final_state.released_amount, 300_0000000i128);
    assert_eq!(final_state.is_completed, true);
}

#[test]
fn test_anti_ghosting_auto_release() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarStreamEscrow, ());
    let client = StellarStreamEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let contractor = Address::generate(&env);
    let arbiter = Address::generate(&env);

    let amounts = vec![&env, 500_0000000i128];
    let titles = vec![&env, String::from_str(&env, "Full Stack Delivery")];

    // Auto-release window is 3600 seconds (1 hour)
    client.initialize(&buyer, &contractor, &arbiter, &3600, &amounts, &titles);

    // Submit milestone at timestamp 1000
    env.ledger().set_timestamp(1000);
    let proof = String::from_str(&env, "ipfs://evidence_done");
    client.submit_milestone(&contractor, &0, &proof);

    // Attempt auto-claim before window expires -> should fail
    env.ledger().set_timestamp(2000); // Only 1000s passed, need 3600s
    let early_claim = client.try_auto_claim_milestone(&contractor, &0);
    assert!(early_claim.is_err());

    // Advance time past auto-release window: 1000 + 3601 = 4601
    env.ledger().set_timestamp(4601);
    client.auto_claim_milestone(&contractor, &0);

    let state = client.get_state();
    assert_eq!(state.released_amount, 500_0000000i128);
    assert_eq!(state.is_completed, true);

    let milestones = client.get_milestones();
    assert_eq!(milestones.get(0).unwrap().status, MilestoneStatus::AutoClaimed);
}

#[test]
fn test_dispute_and_arbiter_resolution() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(StellarStreamEscrow, ());
    let client = StellarStreamEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let contractor = Address::generate(&env);
    let arbiter = Address::generate(&env);

    let amounts = vec![&env, 150_0000000i128];
    let titles = vec![&env, String::from_str(&env, "Design Assets")];

    client.initialize(&buyer, &contractor, &arbiter, &86400, &amounts, &titles);

    let proof = String::from_str(&env, "ipfs://draft");
    client.submit_milestone(&contractor, &0, &proof);

    // Buyer raises dispute
    let reason = String::from_str(&env, "Incomplete assets");
    client.raise_dispute(&buyer, &0, &reason);

    let state = client.get_state();
    assert_eq!(state.is_disputed, true);

    // Arbiter resolves dispute in favor of refunding buyer
    client.resolve_dispute(&arbiter, &0, &false);

    let resolved_state = client.get_state();
    assert_eq!(resolved_state.is_disputed, false);
    assert_eq!(resolved_state.released_amount, 0); // Not paid to contractor
    assert_eq!(resolved_state.is_completed, true);

    let milestones = client.get_milestones();
    assert_eq!(milestones.get(0).unwrap().status, MilestoneStatus::Refunded);
}
