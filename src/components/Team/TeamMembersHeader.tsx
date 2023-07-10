import "./TeamMembersHeader.css";
import { shortenAddress } from "lib/legacy";
import { getTeamUrl } from "domain/leaderboard/urls";
import { useCopyToClipboard, useLocalStorage } from "react-use";
import useRouteQuery from "lib/useRouteQuery";
import { useEffect, useRef, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { ethers } from "ethers";
import {
  approveJoinRequest,
  cancelJoinRequest,
  createJoinRequest,
  getAccountJoinRequest,
  removeMember,
  useAccountJoinRequest,
  useMemberTeam,
} from "domain/leaderboard/contracts";
import { FiInfo, FiX } from "react-icons/fi";
import Checkbox from "components/Checkbox/Checkbox";
import { useUserCodesOnAllChain } from "domain/referrals";
import { useHistory } from "react-router-dom";
import ModalWithPortal from "components/Modal/ModalWithPortal";
import { REFERRALS_SELECTED_TAB_KEY } from "config/localStorage";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import { Team } from "domain/leaderboard/useTeam";
import { Competition } from "domain/leaderboard/useCompetition";

const AFFILIATES_TAB = "Affiliates";

type Inviteprops = {
  team: Team;
  referralCodes: any;
};

function Invite({ team }: Inviteprops) {
  const history = useHistory();
  const { account } = useWeb3React();
  const { chainId } = useChainId();
  const [, copyToClipboard] = useCopyToClipboard();
  const [modalOpen, setModalOpen] = useState(false);
  const [includeReferral, setIncludeReferral] = useState(false);
  const allReferralCodes = useUserCodesOnAllChain(account);
  const [chainReferralCodes, setChainReferralCodes] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState(null);
  const [referralActiveTab, setReferralActiveTab] = useLocalStorage(REFERRALS_SELECTED_TAB_KEY, AFFILIATES_TAB);

  useEffect(() => {
    setChainReferralCodes(
      allReferralCodes !== null && allReferralCodes[chainId] ? Object.values(allReferralCodes[chainId]) : []
    );
  }, [allReferralCodes, chainId]);

  useEffect(() => {
    if (chainReferralCodes.length === 0) {
      setIncludeReferral(false);
    }

    if (!includeReferral) {
      setReferralCode(null);
    } else if (chainReferralCodes.length > 0) {
      setReferralCode(chainReferralCodes[0].codeString);
    }
  }, [includeReferral, chainReferralCodes]);

  const referralLink = () => {
    let link = new URL(window.location.host).toString() + "/#" + getTeamUrl(team.leaderAddress);
    link += `?invite`;
    if (referralCode) {
      link += "&referral=" + referralCode;
    }
    return link;
  };

  const handleCopyClick = () => {
    copyToClipboard(referralLink());
    helperToast.success("Invitation link copied to clipboard!");
    setModalOpen(false);
  };

  const handleReferralCodeChange = ({ target }) => {
    setReferralCode(target.value.trim());
  };

  const handleNewReferralCodeClick = () => {
    if (referralActiveTab !== AFFILIATES_TAB) {
      setReferralActiveTab(AFFILIATES_TAB);
    }

    history.push("/referrals");
  };

  return (
    <>
      <button className="App-button-option" onClick={() => setModalOpen(true)}>
        Invitation Link
      </button>
      <ModalWithPortal isVisible={modalOpen} setIsVisible={setModalOpen} label="Invitation Link">
        <div className="team-modal-content">
          <p>You can include a referral code that will be used by future members using this invitation link.</p>
          {chainReferralCodes.length > 0 ? (
            <div className="team-modal-referral-section">
              <div className="Checkbox">
                <span className="Checkbox-icon-wrapper">
                  <Checkbox isChecked={includeReferral} setIsChecked={setIncludeReferral} />
                </span>
                <span className="Checkbox-label" onClick={() => setIncludeReferral((v) => !v)}>
                  <span className="muted">Include Referral Code</span>
                </span>
              </div>
              {includeReferral && (
                <select onChange={handleReferralCodeChange} className="team-modal-referral-select text-input">
                  {chainReferralCodes.map((code) => (
                    <option key={code.code} value={code.codeString}>
                      {code.codeString}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="team-modal-referral-empty muted">
              <FiInfo />
              <span>No referral code found on this chain</span>
            </div>
          )}
          <div className="divider"></div>
          <div className="App-card-options App-card-options-right">
            <button onClick={() => handleNewReferralCodeClick()} className="App-button-option">
              Create new referral code
            </button>
            <button onClick={() => handleCopyClick()} className="default-btn App-card-option">
              Copy link to clipboard
            </button>
          </div>
        </div>
      </ModalWithPortal>
    </>
  );
}

type ApproveProps = {
  team: Team;
  pendingTxns: any;
  setPendingTxns: any;
  onApprove: () => any;
  competition: Competition;
};

function Approve({ competition, onApprove, team, pendingTxns, setPendingTxns }: ApproveProps) {
  const { chainId, library, account } = useWeb3React();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [inputError, setInputError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [addresses, setAddressess] = useState<string[]>([]);
  const addressInputRef = useRef<HTMLInputElement>(null);

  const hasMembersO = () => {
    return team.members.length + addresses.length >= competition.maxTeamSize;
  };

  useEffect(() => {
    async function main() {
      setIsChecking(true);

      if (value === "") {
        setInputError("");
        setIsChecking(false);
        return;
      }

      if (!ethers.utils.isAddress(value)) {
        setInputError("Enter a valid address");
        setIsChecking(false);
        return;
      }

      const joinRequest = await getAccountJoinRequest(
        chainId,
        library,
        team.competitionIndex,
        ethers.utils.getAddress(value)
      );
      if (joinRequest === null) {
        setInputError("Account did not apply");
        setIsChecking(false);
        return;
      }

      if (joinRequest.leaderAddress !== team.leaderAddress) {
        setInputError("Account did not apply");
        setIsChecking(false);
        return;
      }

      if (addresses.indexOf(value) !== -1) {
        setInputError("Already added to the list");
        setIsChecking(false);
        return;
      }

      setInputError("");
      setIsChecking(false);
    }

    main();
  }, [account, chainId, library, team.competitionIndex, value, team.leaderAddress, addresses]);

  const getMainButtonText = () => {
    if (hasMembersO()) {
      return "Max team size reached";
    }

    if (value === "") {
      return "Enter member address";
    }

    if (isChecking) {
      return "Checking address...";
    }

    if (inputError) {
      return inputError;
    }

    return "Add member address";
  };

  const handleInput = ({ target }) => {
    setValue(target.value.trim());
  };

  const handleAddAddressClick = () => {
    setAddressess((addrs) => [...addrs, value]);
    setValue("");
    addressInputRef.current?.focus();
  };

  const handleRemoveAddress = (addr) => {
    setAddressess((addrs) => addrs.filter((a) => a !== addr));
  };

  const handleModalChange = () => {
    if (open) {
      addressInputRef.current?.focus();
    } else {
      if (addresses.length > 0) {
        setAddressess([]);
      }
      setValue("");
    }
  };

  const sendTransaction = async () => {
    setProcessing(true);

    try {
      const tx = await approveJoinRequest(chainId, library, team.competitionIndex, addresses, {
        successMsg: "Approved!",
        sentMsg: "Approval submitted!",
        failMsg: "Approval failed.",
        pendingTxns,
        setPendingTxns,
      });

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setOpen(false);
        setValue("");
        setAddressess([]);
        onApprove();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err); // FIXME: handle the error
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <button className="App-button-option" disabled={processing} onClick={() => setOpen(true)}>
        {processing ? "Approving..." : "Approve members"}
      </button>
      <ModalWithPortal onAfterOpen={handleModalChange} label="Approve members" isVisible={open} setIsVisible={setOpen}>
        <div className="team-modal-content">
          <p>Enter the member addresses you want to approve below:</p>
          {addresses.length > 0 && (
            <ul className="approve-address-list">
              {addresses.map((address) => (
                <li key={address}>
                  <span>{shortenAddress(address, 16)}</span>
                  <FiX size={16} title="Remove address" onClick={() => handleRemoveAddress(address)} />
                </li>
              ))}
            </ul>
          )}
          {!hasMembersO() && (
            <input
              ref={addressInputRef}
              disabled={processing}
              placeholder="Member address"
              className="text-input text-input-approve"
              type="text"
              value={value}
              onInput={handleInput}
            />
          )}
          <div className="divider"></div>
          <div className="App-card-options App-card-options-right">
            {addresses.length > 0 && (
              <button
                onClick={() => sendTransaction()}
                disabled={processing}
                className="App-button-option App-card-option"
              >
                {processing ? "Approving..." : "Approve members"}
              </button>
            )}
            {!processing && (value.length > 0 || addresses.length === 0) && (
              <button
                className="App-card-option App-button-option"
                disabled={value === "" || inputError || processing ? true : false}
                onClick={() => handleAddAddressClick()}
              >
                {getMainButtonText()}
              </button>
            )}
          </div>
        </div>
      </ModalWithPortal>
    </>
  );
}

type CreateJoinRequestProps = {
  team: Team;
  pendingTxns: any;
  setPendingTxns: any;
  onCreate: () => any;
};

function CreateJoinRequest({ team, pendingTxns, setPendingTxns, onCreate }: CreateJoinRequestProps) {
  const history = useHistory();
  const { chainId, library } = useWeb3React();
  const query = useRouteQuery();
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [modalManuallyOpened, setModalManuallyOpened] = useState(false);

  useEffect(() => {
    const code = query.get("referral");
    if (code !== null && code !== "") {
      setReferralCode(code);
    }
    if (query.has("invite") && !modalManuallyOpened) {
      setOpen(true);
      setModalManuallyOpened(true);
    }
  }, [query, modalManuallyOpened]);

  const handleButtonClick = () => {
    if (referralCode === "") {
      return sendTransaction();
    }

    setOpen(true);
  };

  const sendTransaction = async () => {
    setProcessing(true);

    try {
      const tx = await createJoinRequest(chainId, library, team.competitionIndex, team.leaderAddress, referralCode, {
        successMsg: "Join request created!",
        sentMsg: "Join request submitted!",
        failMsg: "Join request failed.",
        pendingTxns,
        setPendingTxns,
      });

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        onCreate();
        const url = new URL(window.location.href);
        url.searchParams.delete("invite");
        url.searchParams.delete("referral");
        history.replace({
          search: url.searchParams.toString(),
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err); // FIXME: handle the error
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <button className="transparent-btn" disabled={processing} onClick={() => handleButtonClick()}>
        {processing ? "Creating join request..." : "Create join request"}
      </button>
      <ModalWithPortal label="Create Join Request" isVisible={open} setIsVisible={setOpen}>
        <div className="team-modal-content">
          <p>By creating this join request you accept to use the team leader's referral code: </p>
          <p className="team-modal-referral-code">{referralCode}</p>
          <div className="divider"></div>
          <button className="default-btn" onClick={sendTransaction} disabled={processing}>
            {processing ? "Creating join request..." : "Create join request"}
          </button>
        </div>
      </ModalWithPortal>
    </>
  );
}

type CancelJoinRequestProps = {
  team: Team;
  pendingTxns: any;
  setPendingTxns: any;
  onCancel: () => any;
};

function CancelJoinRequest({ team, pendingTxns, setPendingTxns, onCancel }: CancelJoinRequestProps) {
  const { chainId, library } = useWeb3React();
  const [processing, setProcessing] = useState(false);

  const sendTransaction = async () => {
    setProcessing(true);

    try {
      const tx = await cancelJoinRequest(chainId, library, team.competitionIndex, {
        successMsg: "Join request canceled!",
        sentMsg: "Join request cancelation submitted!",
        failMsg: "Join request cancelation failed.",
        pendingTxns,
        setPendingTxns,
      });

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        onCancel();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err); // FIXME: handle the error
    } finally {
      setProcessing(false);
    }
  };

  return (
    <button className="App-button-option" onClick={() => sendTransaction()} disabled={processing}>
      {processing ? "Canceling join request..." : "Cancel join request"}
    </button>
  );
}

type QuitTeamButtonProps = {
  team: Team;
  pendingTxns: any;
  setPendingTxns: any;
  onQuit: () => any;
};

function QuitTeamButton({ team, pendingTxns, setPendingTxns, onQuit }: QuitTeamButtonProps) {
  const { chainId, library, account } = useWeb3React();
  const [processing, setProcessing] = useState(false);

  const sendTransaction = async () => {
    setProcessing(true);

    try {
      const tx = await removeMember(chainId, library, team.competitionIndex, team.leaderAddress, account, {
        successMsg: "Success!",
        sentMsg: "Transaction submitted!",
        failMsg: "Transaction failed.",
        pendingTxns,
        setPendingTxns,
      });

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        onQuit();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err); // FIXME: handle the error
    } finally {
      setProcessing(false);
    }
  };

  return (
    <button className="transparent-btn" disabled={processing} onClick={() => sendTransaction()}>
      {processing ? "Leaving team..." : "Leave team"}
    </button>
  );
}

type TeamMemberHeaderProps = {
  competition: Competition;
  team: Team;
  pendingTxns: any;
  setPendingTxns: any;
  onMembersChange: () => any;
};

export default function TeamMembersHeader({
  competition,
  onMembersChange,
  team,
  pendingTxns,
  setPendingTxns,
}: TeamMemberHeaderProps) {
  const { chainId, library, account } = useWeb3React();
  const referralCodes = useUserCodesOnAllChain(account);

  const {
    exists: hasJoinRequest,
    loading: accountJoinRequestLoading,
    revalidate: revalidateJoinRequest,
  } = useAccountJoinRequest(chainId, library, team.competitionIndex, account);

  const {
    data: memberTeam,
    loading: memberTeamLoading,
    revalidate: revalidateMemberTeam,
  } = useMemberTeam(chainId, library, team.competitionIndex, account);

  const isLeader = () => account === team.leaderAddress;
  const isMember = () => memberTeam === team.leaderAddress;

  const onQuit = () => {
    revalidateMemberTeam();
    onMembersChange();
  };

  if (memberTeamLoading || accountJoinRequestLoading) {
    return <></>;
  }

  return (
    <div className="team-members-table-top-header">
      {isLeader() && team.members.length < competition.maxTeamSize && (
        <>
          <Invite referralCodes={referralCodes} team={team} />
          <Approve
            competition={competition}
            team={team}
            pendingTxns={pendingTxns}
            setPendingTxns={setPendingTxns}
            onApprove={onMembersChange}
          />
        </>
      )}

      {!isLeader() && (
        <>
          {!isMember() && !hasJoinRequest && (
            <CreateJoinRequest
              onCreate={revalidateJoinRequest}
              team={team}
              setPendingTxns={setPendingTxns}
              pendingTxns={pendingTxns}
            />
          )}
          {!isMember() && hasJoinRequest && (
            <CancelJoinRequest
              onCancel={revalidateJoinRequest}
              team={team}
              setPendingTxns={setPendingTxns}
              pendingTxns={pendingTxns}
            />
          )}
          {isMember() && (
            <QuitTeamButton team={team} onQuit={onQuit} setPendingTxns={setPendingTxns} pendingTxns={pendingTxns} />
          )}
        </>
      )}
    </div>
  );
}
