import { Trans } from "@lingui/macro";
import { useWeb3React } from "@web3-react/core";
import { useChainId } from "lib/chains";
import { useEffect, useState } from "react";
import { FiPlus, FiSearch } from "react-icons/fi";
import { Link, useHistory } from "react-router-dom";
import { useDebounce } from "lib/useDebounce";
import { useMemberTeam } from "domain/leaderboard/contracts";
import { getTeamRegistrationUrl, getTeamUrl } from "domain/leaderboard/urls";
import "./Leaderboard.css";
import { formatAmount } from "lib/numbers";
import Pagination from "components/Pagination/Pagination";
import useTeamLeaderboard from "domain/leaderboard/useTeamLeaderboard";
import { useCompetition } from "domain/leaderboard/useCompetition";
import { useTeam } from "domain/leaderboard/useTeam";

export function TeamLeaderboard({ competitionIndex }) {
  const history = useHistory();
  const { chainId } = useChainId();
  const { library, account } = useWeb3React();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const perPage = 15;
  const { data: teams, loading: teamsLoading } = useTeamLeaderboard(chainId, competitionIndex);
  const { data: competition, loading: competitionLoading } = useCompetition(chainId, competitionIndex);
  const { exists: isLeader, loading: teamLoading } = useTeam(chainId, library, competitionIndex, account);
  const {
    data: userTeam,
    hasTeam,
    loading: memberTeamLoading,
  } = useMemberTeam(chainId, library, competitionIndex, account);

  const filteredTeams = () => {
    return teams.filter((stat) => {
      return (
        stat.name.toLowerCase().indexOf(debouncedSearch.toLowerCase()) !== -1 ||
        stat.address.indexOf(debouncedSearch.toLowerCase()) !== -1
      );
    });
  };

  const displayedTeams = () => {
    return filteredTeams().slice((page - 1) * perPage, page * perPage);
  };

  const handleSearchInput = ({ target }) => {
    setSearch(target.value);
  };

  const pageCount = () => {
    return Math.ceil(filteredTeams().length / perPage);
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  return (
    <div>
      <div className={`leaderboard-header`}>
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Search Team"
            className="leaderboard-search-input text-input input-small"
            value={search}
            onInput={handleSearchInput}
          />
          <FiSearch className="input-logo" />
        </div>
        {competitionLoading || teamLoading || memberTeamLoading || !account ? (
          ""
        ) : (
          <>
            {competition.registrationActive && !isLeader && !hasTeam && (
              <Link className="transparent-btn" to={getTeamRegistrationUrl()}>
                <FiPlus />
                <span className="ml-small">Create Team</span>
              </Link>
            )}
            {(isLeader || hasTeam) && (
              <Link className="App-button-option" to={getTeamUrl(isLeader ? account : userTeam)}>
                View your team
              </Link>
            )}
          </>
        )}
      </div>
      <table className="Exchange-list large App-box">
        <tbody>
          <tr className="Exchange-list-header">
            <th>
              <Trans>Rank</Trans>
            </th>
            <th>
              <Trans>Team Name</Trans>
            </th>
            <th>
              <Trans>PnL</Trans>
            </th>
            <th>
              <Trans>Open Positions</Trans>
            </th>
            <th>
              <Trans>Members</Trans>
            </th>
            <th></th>
          </tr>
          {teamsLoading && (
            <tr>
              <td colSpan={5}>Loading...</td>
            </tr>
          )}
          {!teamsLoading && filteredTeams().length === 0 && (
            <tr>
              <td colSpan={9}>Not team found</td>
            </tr>
          )}
          {displayedTeams().map((team) => (
            <tr key={team.id}>
              <td>#1</td>
              <td>{team.name}</td>
              <td>-$1,425 (-5.8%)</td>
              <td>{team.positions.length}</td>
              <td>{team.members.length}</td>
              <td className="text-right">
                <button className="Exchange-list-action" onClick={() => history.push(getTeamUrl(team.address))}>
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="Exchange-list small">
        {teamsLoading && <div className="Exchange-empty-positions-list-note App-card">Loading...</div>}
        {!teamsLoading && displayedTeams().length === 0 && (
          <div className="Exchange-empty-positions-list-note App-card">No account found</div>
        )}
        {displayedTeams().map((team, i) => (
          <div key={team.id} className="App-card">
            <div className="App-card-title">
              <span className="label">
                #{i + 1} - {team.name}
              </span>
              <button className="Exchange-list-action" onClick={() => history.push(getTeamUrl(team.address))}>
                Details
              </button>
            </div>
            <div className="App-card-divider"></div>
            <div className="App-card-content">
              <div className="App-card-row">
                <div className="label">PnL</div>
                <div>${formatAmount(team.pnl, 2, 1, true, "...")}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount()} onPageChange={(page) => setPage(page)} />
    </div>
  );
}
