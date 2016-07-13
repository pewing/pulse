//
// The client is sending messages to the 'server'.
// In this case, 'server' just means a known ip and port,
// but we are giving the server data, not vice-versa.
//

#include <arpa/inet.h>
//#include <netinet/in.h>
#include <stdio.h>
#include <time.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <unistd.h>

#include <stdlib.h> // exit() on some platforms.
#include <string.h> // memset() on some platforms.

#include "BPMPulse.h"

int
SetupAnnounce_udp(char* ip, short port, int* sock, struct sockaddr_in* si_toserver)
{
	if ((*sock=socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP))==-1) {
		//Fatal("Can't create socket\n");
		return -1;
	}

	memset((char *)si_toserver, 0, sizeof(*si_toserver));
	si_toserver->sin_family = AF_INET;
	si_toserver->sin_port = htons(port);

	if (inet_aton(ip, &(si_toserver->sin_addr))==0) {
		//Fatal("inet_aton() failed\n");
		return -2;
	}

	return 0; // good.
}

//
// pass in the beat period in milliseconds, also the elapsed time
// in milliseconds from to most recent heart beat to now.
//
void
AnnounceBPMdata_udp(double interval_ms, double elapsed_ms, int sock, struct sockaddr_in* si) {

	BPMPulseData_t data;
	int i;

	data.beat_interval_ms = interval_ms;
	data.elapsed_ms = elapsed_ms;
	sendto(sock, (char*)&data, sizeof(data), 0, (struct sockaddr*)si, sizeof(struct sockaddr_in));
}

#ifdef UNIT_TEST
int main(int ac, char* av[]) {

	char* srv_ip = "127.0.0.1";
	short port = 1234;
	int errors = 0;
	int verbose = 0;

	if (ac > 1) srv_ip = av[1];
	if (ac > 2) port = atoi(av[2]);

	struct sockaddr_in si_toserver;
	int s, i;

	//socklen_t slen;
	//int slen; // change for your platform.


	if (SetupAnnounce_udp(&s,&si_toserver) != 0) {
		printf("Can't setup udp socket\n");
		exit(1);
	}
	TestServer(s, &si_toserver);

	close(s);
	return 0;
}
#endif // UNIT_TEST

