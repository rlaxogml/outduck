"use client";

import { useState, useEffect } from "react";

export function useKakaoAddress(
  locationInput: string,
  isManualLocation: boolean,
  isScriptLoaded: boolean
) {
  const [addrResults, setAddrResults] = useState<any[]>([]);
  const [isSearchingAddr, setIsSearchingAddr] = useState(false);

  useEffect(() => {
    if (isManualLocation || !locationInput || locationInput.trim().length < 2) {
      setAddrResults([]);
      return;
    }

    const timer = setTimeout(() => {
      if (typeof window === "undefined" || !window.kakao || !window.kakao.maps) return;

      const performSearch = () => {
        if (!window.kakao.maps.services) return;
        const places = new window.kakao.maps.services.Places();
        const geocoder = new window.kakao.maps.services.Geocoder();

        setIsSearchingAddr(true);
        places.keywordSearch(locationInput, (data: any, status: any) => {
          if (status === window.kakao.maps.services.Status.OK && data && data.length > 0) {
            const formatted = data.map((item: any) => ({
              address: item.address_name,
              placeName: item.place_name,
              lat: item.y ? parseFloat(item.y) : null,
              lng: item.x ? parseFloat(item.x) : null,
            }));
            setAddrResults(formatted);
            setIsSearchingAddr(false);
          } else {
            geocoder.addressSearch(locationInput, (result: any, addrStatus: any) => {
              if (addrStatus === window.kakao.maps.services.Status.OK && result && result.length > 0) {
                const formatted = result.map((item: any) => ({
                  address: item.address_name,
                  placeName: item.place_name || item.address_name,
                  lat: item.y ? parseFloat(item.y) : null,
                  lng: item.x ? parseFloat(item.x) : null,
                }));
                setAddrResults(formatted);
              } else {
                setAddrResults([]);
              }
              setIsSearchingAddr(false);
            });
          }
        });
      };

      if (window.kakao.maps.services) {
        performSearch();
      } else {
        window.kakao.maps.load(performSearch);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [locationInput, isManualLocation, isScriptLoaded]);

  return { addrResults, isSearchingAddr, setAddrResults };
}
