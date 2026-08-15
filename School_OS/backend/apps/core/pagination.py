"""
Shared DRF pagination — apps.core
"""
from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """Global paginator: pages of 25 by default, clients may override via
    ?page_size= (up to 500) so large catalogs (subjects, classes) are never
    silently truncated."""

    page_size_query_param = 'page_size'
    max_page_size = 500
