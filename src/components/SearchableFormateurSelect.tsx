import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { Profile, TrainerLevel } from '../types';
import { TRAINER_LEVEL_LABELS } from '../utils/constants';

interface SearchableFormateurSelectProps {
  level: TrainerLevel;
  index: number;
  value: string;
  profiles: Profile[];
  onChange: (value: string) => void;
}

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

export default function SearchableFormateurSelect({
  level,
  index,
  value,
  profiles,
  onChange,
}: SearchableFormateurSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedProfile = profiles.find((profile) => profile.id === value);
  const filteredProfiles = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) {
      return profiles;
    }

    return profiles
      .filter((profile) => {
        const searchableValue = normalizeSearchValue(`${profile.displayName} ${profile.email}`);
        return searchableValue.includes(normalizedQuery);
      })
      .sort((first, second) => {
        const firstStartsWithQuery = normalizeSearchValue(first.displayName).startsWith(normalizedQuery);
        const secondStartsWithQuery = normalizeSearchValue(second.displayName).startsWith(normalizedQuery);
        return Number(secondStartsWithQuery) - Number(firstStartsWithQuery);
      });
  }, [profiles, query]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [open]);

  const openSearch = () => {
    setOpen(true);
    setQuery('');
  };

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setOpen(true);
    if (value) {
      onChange('');
    }
  };

  const selectProfile = (profile: Profile) => {
    onChange(profile.id);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
      return;
    }

    if (event.key === 'Enter' && filteredProfiles[0]) {
      event.preventDefault();
      selectProfile(filteredProfiles[0]);
    }
  };

  const inputValue = open ? query : selectedProfile?.displayName ?? '';

  return (
    <label className="block">
      <span className="mb-1.5 block text-label-sm text-on-surface-variant">
        {TRAINER_LEVEL_LABELS[level]} {index + 1}
      </span>
      <div ref={containerRef} className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-on-surface-variant"
          aria-hidden="true"
        />
        <input
          type="text"
          role="combobox"
          value={inputValue}
          onFocus={openSearch}
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher un utilisateur..."
          autoComplete="off"
          aria-label={`${TRAINER_LEVEL_LABELS[level]} ${index + 1}`}
          aria-expanded={open}
          aria-autocomplete="list"
          className="block w-full rounded-squircle-sm bg-surface-container-highest py-3 pl-10 pr-10 text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {value && !open ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              openSearch();
            }}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high"
            aria-label={`Effacer le formateur ${TRAINER_LEVEL_LABELS[level]} ${index + 1}`}
          >
            <X size={16} />
          </button>
        ) : (
          <ChevronDown
            size={17}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            aria-hidden="true"
          />
        )}

        {open ? (
          <div
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-squircle-sm border border-outline-variant/70 bg-surface-container-lowest p-1 shadow-ambient-lg"
            role="listbox"
            aria-label={`Utilisateurs ${TRAINER_LEVEL_LABELS[level]}`}
          >
            {filteredProfiles.length > 0 ? filteredProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                role="option"
                aria-selected={profile.id === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectProfile(profile)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-body-md text-on-surface hover:bg-surface-container focus:bg-surface-container focus:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{profile.displayName}</span>
                  <span className="block truncate text-label-sm text-on-surface-variant">{profile.email}</span>
                </span>
                {profile.id === value ? <Check size={16} className="shrink-0 text-primary" /> : null}
              </button>
            )) : (
              <p className="px-3 py-3 text-body-sm text-on-surface-variant">
                Aucun utilisateur ne correspond à cette recherche.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </label>
  );
}
